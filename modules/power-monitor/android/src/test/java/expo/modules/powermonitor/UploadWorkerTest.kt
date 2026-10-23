package expo.modules.powermonitor

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException

/** EventStore en memoria: mismo orden (at, id) y misma regla de "último snapshot subido". */
private class MemoryUploadStore(events: List<Event>) : UploadStore {
  val events = events.toMutableList()
  val uploaded = mutableSetOf<String>()

  override fun pending(limit: Int): List<Event> =
    events.filter { it.id !in uploaded }.sortedWith(compareBy({ it.at }, { it.id })).take(limit)

  override fun lastUploadedSnapshotJson(): String? =
    events.filter { it.kind == "snapshot" && it.id in uploaded }
      .maxWithOrNull(compareBy({ it.at }, { it.id }))?.json

  override fun markUploaded(ids: Collection<String>) {
    uploaded.addAll(ids)
  }

  override fun pendingCount(): Int = events.count { it.id !in uploaded }
}

private data class Sent(val url: String, val token: String, val body: JSONObject) {
  val ids: List<String>
    get() {
      val events = body.getJSONArray("events")
      return (0 until events.length()).map { events.getJSONObject(it).getString("id") }
    }
}

/** ApiHttp falso: responde en orden lo que se le programa. Una excepción simula la falta de red. */
private class FakeHttp(vararg responses: Any) : ApiHttp {
  private val queue = ArrayDeque(responses.toList())
  val sent = mutableListOf<Sent>()

  override fun postJson(url: String, token: String, body: String): HttpResponse {
    sent += Sent(url, token, JSONObject(body))
    return when (val next = queue.removeFirstOrNull() ?: ok()) {
      is IOException -> throw next
      is HttpResponse -> next
      else -> error("respuesta falsa desconocida: $next")
    }
  }
}

private const val STATUS_JSON =
  """{"state":"sin_luz","since":1793570400000,"alias":"Casa","openOutageStart":1793570400000}"""

private fun ok(status: String = STATUS_JSON) =
  HttpResponse(200, """{"accepted":1,"duplicated":0,"status":$status}""", null)

class UploadWorkerTest {
  private val statuses = mutableListOf<String>()
  private val rejected = mutableListOf<String>()

  private fun uploader(store: UploadStore, http: ApiHttp, token: String? = "tok_abc") = Uploader(
    store = store,
    http = http,
    apiUrl = "https://api.example.test",
    token = token,
    diagnostics = { fullDiagnostics() },
    clock = { 1_793_570_500_000L },
    onStatus = { statuses += it },
    onTokenRejected = { rejected += it },
  )

  @Test
  fun `el cursor no avanza si la respuesta no es 2xx`() {
    val store = MemoryUploadStore(listOf(reportEvent(1), snapshotEvent(2)))
    val http = FakeHttp(HttpResponse(500, """{"error":{"code":"internal_error","message":"x"}}""", null))

    val outcome = uploader(store, http).run()

    assertEquals(UploadOutcome.Retry, outcome)
    assertTrue(store.uploaded.isEmpty())
    assertEquals(2, store.pendingCount())
    assertTrue(statuses.isEmpty())
  }

  @Test
  fun `un reenvío tras timeout manda los mismos ids`() {
    val store = MemoryUploadStore(listOf(reportEvent(1), snapshotEvent(2), reportEvent(3)))
    val http = FakeHttp(SocketTimeoutException("timeout"), ok())

    assertEquals(UploadOutcome.Retry, uploader(store, http).run())
    assertTrue(store.uploaded.isEmpty())
    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(2, http.sent.size)
    assertEquals(http.sent[0].ids, http.sent[1].ids)
    assertEquals(listOf(reportEvent(1).id, snapshotEvent(2).id, reportEvent(3).id), http.sent[1].ids)
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `450 pendientes salen en 3 lotes ordenados`() {
    val all = (1..450).map { reportEvent(it) }
    val store = MemoryUploadStore(all.shuffled(java.util.Random(7)))
    val http = FakeHttp()

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(listOf(200, 200, 50), http.sent.map { it.ids.size })
    assertEquals(all.map { it.id }, http.sent.flatMap { it.ids })
    assertEquals(0, store.pendingCount())
    http.sent.forEach {
      assertEquals("https://api.example.test/v1/events", it.url)
      assertEquals("tok_abc", it.token)
    }
  }

  @Test
  fun `los snapshots saltados se marcan como subidos sin enviarse`() {
    val store = MemoryUploadStore(listOf(snapshotEvent(1), snapshotEvent(2), snapshotEvent(3, plugged = false)))
    val http = FakeHttp()

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(listOf(snapshotEvent(1).id, snapshotEvent(3).id), http.sent.single().ids)
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `el último snapshot subido decide si el siguiente repite`() {
    val store = MemoryUploadStore(listOf(snapshotEvent(1)))
    store.uploaded += snapshotEvent(1).id
    store.events += snapshotEvent(2) // mismo estado que el ya subido
    val http = FakeHttp()

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    // Viaja el latido vacío, y el snapshot repetido queda marcado.
    assertTrue(http.sent.single().ids.isEmpty())
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `sin pendientes viaja el latido vacío`() {
    val http = FakeHttp()

    assertEquals(UploadOutcome.Done, uploader(MemoryUploadStore(emptyList()), http).run())

    assertEquals(1, http.sent.size)
    assertTrue(http.sent.single().ids.isEmpty())
  }

  @Test
  fun `401 detiene la subida y marca el token como inválido`() {
    val store = MemoryUploadStore((1..450).map { reportEvent(it) })
    val http = FakeHttp(HttpResponse(401, """{"error":{"code":"invalid_token","message":"x"}}""", null))

    val outcome = uploader(store, http, token = "tok_viejo").run()

    assertEquals(UploadOutcome.TokenRejected, outcome)
    assertEquals(1, http.sent.size)
    assertEquals(listOf("tok_viejo"), rejected)
    assertTrue(store.uploaded.isEmpty())
  }

  @Test
  fun `429 reintenta`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))
    val http = FakeHttp(HttpResponse(429, """{"error":{"code":"rate_limited","message":"x"}}""", 60))

    val outcome = uploader(store, http).run()

    assertEquals(UploadOutcome.RetryAfter(60_000L), outcome)
    assertEquals(1, http.sent.size)
    assertTrue(store.uploaded.isEmpty())
    assertTrue(rejected.isEmpty())
  }

  @Test
  fun `429 sin Retry-After espera 60 s`() {
    val http = FakeHttp(HttpResponse(429, "", null))

    assertEquals(UploadOutcome.RetryAfter(60_000L), uploader(MemoryUploadStore(emptyList()), http).run())
  }

  @Test
  fun `guarda el status de la respuesta`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))

    uploader(store, FakeHttp(ok())).run()

    assertEquals(1, statuses.size)
    assertEquals(JSONObject(STATUS_JSON).toString(), JSONObject(statuses.single()).toString())
  }

  @Test
  fun `un 2xx con cuerpo ilegible marca los eventos y no guarda status`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))

    assertEquals(UploadOutcome.Done, uploader(store, FakeHttp(HttpResponse(200, "no-json", null))).run())

    assertEquals(0, store.pendingCount())
    assertTrue(statuses.isEmpty())
  }

  @Test
  fun `sin token no hace nada`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))
    val http = FakeHttp()

    assertEquals(UploadOutcome.NoToken, uploader(store, http, token = null).run())

    assertTrue(http.sent.isEmpty())
    assertEquals(1, store.pendingCount())
  }

  @Test
  fun `Retry-After se lee en segundos y se ignora si no es un número`() {
    assertEquals(60L, UrlConnectionApiHttp.parseRetryAfter("60"))
    assertEquals(5L, UrlConnectionApiHttp.parseRetryAfter(" 5 "))
    assertNull(UrlConnectionApiHttp.parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT"))
    assertNull(UrlConnectionApiHttp.parseRetryAfter(null))
  }
}
