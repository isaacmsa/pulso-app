package expo.modules.powermonitor

import org.json.JSONObject
import androidx.work.WorkInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeoutException
import kotlin.random.Random

/** EventStore en memoria: mismo orden (at, id) y misma regla de "último snapshot subido". */
private class MemoryUploadStore(events: List<Event>) : UploadStore {
  val events = events.toMutableList()
  val uploaded = mutableSetOf<String>()
  val rejected = mutableSetOf<String>()
  var failWith: RuntimeException? = null

  private fun open() = events.filter { it.id !in uploaded && it.id !in rejected }

  override fun pending(limit: Int): List<Event> {
    failWith?.let { throw it }
    return open().sortedWith(compareBy({ it.at }, { it.id })).take(limit)
  }

  override fun lastUploadedSnapshotJson(): String? =
    events.filter { it.kind == "snapshot" && it.id in uploaded }
      .maxWithOrNull(compareBy({ it.at }, { it.id }))?.json

  override fun markUploaded(ids: Collection<String>) {
    uploaded.addAll(ids)
  }

  override fun markRejected(ids: Collection<String>) {
    rejected.addAll(ids)
  }

  override fun pendingCount(): Int = open().size
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
  private val statuses = mutableListOf<Pair<String, Long>>()
  private val rejected = mutableListOf<String>()

  private fun uploader(
    store: UploadStore,
    http: ApiHttp,
    token: String? = "tok_abc",
    shouldStop: () -> Boolean = { false },
  ) = Uploader(
    store = store,
    http = http,
    apiUrl = "https://api.example.test",
    token = token,
    diagnostics = { fullDiagnostics() },
    clock = { 1_793_570_500_000L },
    onStatus = { status, receivedAt -> statuses += status to receivedAt },
    onTokenRejected = { rejected += it },
    shouldStop = shouldStop,
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

    val (status, receivedAt) = statuses.single()
    assertEquals(JSONObject(STATUS_JSON).toString(), JSONObject(status).toString())
    assertEquals(1_793_570_500_000L, receivedAt)
  }

  @Test
  fun `el estado guardado lleva status y receivedAt`() {
    val saved = JSONObject(LastServerStatus.encode(STATUS_JSON, 1_793_570_500_000L))

    assertEquals(setOf("status", "receivedAt"), saved.keys().asSequence().toSet())
    assertEquals(1_793_570_500_000L, saved.getLong("receivedAt"))
    assertEquals(JSONObject(STATUS_JSON).toString(), saved.getJSONObject("status").toString())
  }

  @Test
  fun `un 400 marca el lote como rechazado y sigue con el siguiente`() {
    val all = (1..250).map { reportEvent(it) }
    val store = MemoryUploadStore(all)
    val http = FakeHttp(HttpResponse(400, """{"error":{"code":"validation_failed","message":"x"}}""", null), ok())

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(2, http.sent.size)
    assertEquals(all.take(200).map { it.id }.toSet(), store.rejected)
    assertEquals(all.drop(200).map { it.id }, http.sent[1].ids)
    assertEquals(all.drop(200).map { it.id }.toSet(), store.uploaded)
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `un 400 no rechaza los snapshots saltados que no viajaron`() {
    // El 2 repite al 1 dentro del lote rechazado: el servidor no conoce ese estado, así que el 2 vuelve a evaluarse.
    val store = MemoryUploadStore(listOf(snapshotEvent(1), snapshotEvent(2)))
    val http = FakeHttp(HttpResponse(400, "", null), ok())

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(setOf(snapshotEvent(1).id), store.rejected)
    assertEquals(listOf(snapshotEvent(2).id), http.sent[1].ids)
  }

  @Test
  fun `un evento guardado ilegible se rechaza sin frenar la subida`() {
    val broken = Event("0192f3a4-5b6c-7d8e-9f01-000000000002", 1_793_570_402_000L, "report", "{no es json")
    val store = MemoryUploadStore(listOf(reportEvent(1), broken, snapshotEvent(3)))
    val http = FakeHttp()

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(listOf(reportEvent(1).id, snapshotEvent(3).id), http.sent.single().ids)
    assertEquals(setOf(broken.id), store.rejected)
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `404 no reintenta`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))
    val http = FakeHttp(HttpResponse(404, """{"error":{"code":"not_found","message":"x"}}""", null))

    val outcome = uploader(store, http).run()

    assertEquals(UploadOutcome.NoHome, outcome)
    assertEquals(WorkDecision.Failure, UploadPolicy.resultFor(outcome, runAttemptCount = 0))
    assertEquals(1, http.sent.size)
    assertEquals(1, store.pendingCount())
  }

  @Test
  fun `una excepción inesperada termina en Retry`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))
    store.failWith = IllegalStateException("la base está bloqueada")

    assertEquals(UploadOutcome.Retry, uploader(store, FakeHttp()).run())
  }

  @Test
  fun `reintenta hasta 3 veces`() {
    for (attempt in 0 until UploadPolicy.MAX_RETRIES) {
      assertEquals(WorkDecision.Retry, UploadPolicy.resultFor(UploadOutcome.Retry, attempt))
    }
  }

  @Test
  fun `a la cuarta falla termina y deja los eventos pendientes`() {
    val store = MemoryUploadStore(listOf(reportEvent(1), reportEvent(2)))
    val http = FakeHttp(HttpResponse(503, "", null))

    val outcome = uploader(store, http).run()

    assertEquals(WorkDecision.Success, UploadPolicy.resultFor(outcome, runAttemptCount = 3))
    assertEquals(2, store.pendingCount())
    assertTrue(store.uploaded.isEmpty() && store.rejected.isEmpty())
  }

  @Test
  fun `la política no reintenta lo que no es un error pasajero`() {
    assertEquals(WorkDecision.Success, UploadPolicy.resultFor(UploadOutcome.Done, 0))
    assertEquals(WorkDecision.Success, UploadPolicy.resultFor(UploadOutcome.NoToken, 0))
    assertEquals(WorkDecision.Success, UploadPolicy.resultFor(UploadOutcome.TokenRejected, 0))
    assertEquals(WorkDecision.RescheduleAfter(60_000L), UploadPolicy.resultFor(UploadOutcome.RetryAfter(60_000L), 5))
  }

  @Test
  fun `el retraso inicial va de 0 a 60 s al azar`() {
    assertEquals(60_000L, UploadPolicy.MAX_JITTER_MS)
    val random = Random(42)
    val delays = (1..1_000).map { UploadPolicy.initialDelayMs(5_000L, random) }
    assertTrue(delays.all { it in 5_000L..65_000L })
    assertTrue(delays.any { it > 15_000L })
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

  @Test
  fun `una subida encolada sin red espera 0–60 s después de que vuelve la red`() {
    // Encolar no gasta la espera: la solicitud no trae retraso propio, así que no se consume mientras no hay red.
    assertEquals(0L, UploadPolicy.ENQUEUE_DELAY_MS)
    // La primera corrida llega cuando vuelve la red y se reprograma una vez con 0 a 60 s al azar.
    val random = Random(42)
    val delays = (1..1_000).map {
      val decision = UploadPolicy.startDecision(waited = false, runAttemptCount = 0, random = random)
      (decision as StartDecision.WaitFirst).delayMs
    }
    assertTrue(delays.all { it in 0L..UploadPolicy.MAX_JITTER_MS })
    assertTrue(delays.any { it > 15_000L })
    // La reprogramada ya esperó y sube; un reintento con backoff tampoco vuelve a esperar.
    assertEquals(StartDecision.Upload, UploadPolicy.startDecision(waited = true, runAttemptCount = 0))
    assertEquals(StartDecision.Upload, UploadPolicy.startDecision(waited = false, runAttemptCount = 1))
  }

  @Test
  fun `sin red, varios latidos dejan una sola subida pendiente`() {
    // La cadena única "upload": sin red, la primera queda ENQUEUED esperando la red.
    val chain = mutableListOf<WorkInfo.State>()
    repeat(8) { if (UploadPolicy.shouldEnqueue(chain)) chain += WorkInfo.State.ENQUEUED }
    assertEquals(listOf(WorkInfo.State.ENQUEUED), chain)
  }

  @Test
  fun `solo se encadena una subida detrás de la que está corriendo`() {
    assertTrue(UploadPolicy.shouldEnqueue(emptyList()))
    assertTrue(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.SUCCEEDED)))
    assertTrue(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.FAILED, WorkInfo.State.CANCELLED)))
    assertTrue(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.SUCCEEDED, WorkInfo.State.RUNNING)))
    assertFalse(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.ENQUEUED)))
    assertFalse(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.BLOCKED)))
    assertFalse(UploadPolicy.shouldEnqueue(listOf(WorkInfo.State.RUNNING, WorkInfo.State.BLOCKED)))
  }

  @Test
  fun `el cuerpo de la respuesta se lee hasta 64 KB`() {
    assertEquals(64 * 1024, UrlConnectionApiHttp.MAX_BODY_BYTES)
    val max = UrlConnectionApiHttp.MAX_BODY_BYTES
    val small = "{\"ok\":true,\"alias\":\"Casa de Mamá\"}"
    assertEquals(small, UrlConnectionApiHttp.readCapped(ByteArrayInputStream(small.toByteArray())))
    assertEquals(max, UrlConnectionApiHttp.readCapped(ByteArrayInputStream(ByteArray(max) { 'a'.code.toByte() }))?.length)
    assertNull(UrlConnectionApiHttp.readCapped(ByteArrayInputStream(ByteArray(max + 1) { 'a'.code.toByte() })))
  }

  @Test
  fun `una corrida detenida no manda el lote siguiente`() {
    val store = MemoryUploadStore((1..450).map { reportEvent(it) })
    val http = FakeHttp()

    val outcome = uploader(store, http, shouldStop = { http.sent.isNotEmpty() }).run()

    assertEquals(UploadOutcome.Retry, outcome)
    assertEquals(1, http.sent.size)
    assertEquals(250, store.pendingCount())
  }

  @Test
  fun `un 413 rechaza el lote y sigue como un 400`() {
    val all = (1..250).map { reportEvent(it) }
    val store = MemoryUploadStore(all)
    val http = FakeHttp(HttpResponse(413, "", null), ok())

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(all.take(200).map { it.id }.toSet(), store.rejected)
    assertEquals(all.drop(200).map { it.id }.toSet(), store.uploaded)
    assertEquals(0, store.pendingCount())
  }

  @Test
  fun `una corrida cuyo único pedido recibió 400 igual manda el latido`() {
    val store = MemoryUploadStore(listOf(reportEvent(1)))
    val http = FakeHttp(HttpResponse(400, "", null), ok())

    assertEquals(UploadOutcome.Done, uploader(store, http).run())

    assertEquals(2, http.sent.size)
    assertTrue(http.sent[1].ids.isEmpty())
    assertEquals(setOf(reportEvent(1).id), store.rejected)
    assertEquals(1, statuses.size)
  }

  @Test
  fun `un latido no agrega una espera`() {
    // El latido, los cambios de estado y lo que pide la pantalla (reporte, confirmación, requestUpload) suben ya.
    for (source in listOf("heartbeat", "power_receiver", "charging_job", "transition_check", "app_open")) {
      assertFalse(source, UploadPolicy.jitterFor(source))
    }
    val waited = !UploadPolicy.jitterFor("heartbeat")
    assertEquals(StartDecision.Upload, UploadPolicy.startDecision(waited = waited, runAttemptCount = 0))
    // Unos segundos tarde por el planificador no es "esperó la red".
    assertEquals(
      StartDecision.Upload,
      UploadPolicy.startDecision(waited = true, runAttemptCount = 0, lateByMs = UploadPolicy.LATE_START_MS),
    )
  }

  @Test
  fun `la vuelta del Wi-Fi sí espera 0–60 s`() {
    assertTrue(UploadPolicy.jitterFor("network_callback"))
    assertTrue(UploadPolicy.jitterFor("boot"))
    val random = Random(7)
    repeat(200) {
      val decision = UploadPolicy.startDecision(
        waited = !UploadPolicy.jitterFor("network_callback"),
        runAttemptCount = 0,
        random = random,
      )
      assertTrue((decision as StartDecision.WaitFirst).delayMs in 0L..UploadPolicy.MAX_JITTER_MS)
    }
  }

  @Test
  fun `un latido que quedó esperando la red espera 0–60 s al arrancar`() {
    // Sin red durante el corte, el latido deja su subida ENQUEUED y la vuelta del Wi-Fi no encola otra: esa subida
    // es la que sale cuando vuelve la red, junto con toda la zona, así que tiene que esperar.
    val decision = UploadPolicy.startDecision(
      waited = true,
      runAttemptCount = 0,
      lateByMs = UploadPolicy.LATE_START_MS + 1,
      random = Random(1),
    )
    assertTrue(decision is StartDecision.WaitFirst)
    // Un reintento con backoff no vuelve a esperar.
    assertEquals(StartDecision.Upload, UploadPolicy.startDecision(waited = true, runAttemptCount = 1, lateByMs = 600_000))
  }

  @Test
  fun `si leer la cadena se pasa de 2 s, se encola igual`() {
    assertEquals(2_000L, UploadPolicy.WORK_MANAGER_TIMEOUT_MS)
    val states = UploadPolicy.chainStatesOrNull { throw TimeoutException() }
    assertNull(states)
    assertTrue(UploadPolicy.shouldEnqueue(states))
    val pending = UploadPolicy.chainStatesOrNull { listOf(WorkInfo.State.ENQUEUED) }
    assertFalse(UploadPolicy.shouldEnqueue(pending))
  }

  @Test
  fun `encolar en el hilo principal falla fuerte`() {
    assertEquals(ThreadGuard.Ok, UploadPolicy.threadGuard(onMainThread = false, debuggable = true))
    assertEquals(ThreadGuard.Throw, UploadPolicy.threadGuard(onMainThread = true, debuggable = true))
    assertEquals(ThreadGuard.Wtf, UploadPolicy.threadGuard(onMainThread = true, debuggable = false))
  }

  @Test
  fun `si no se pudo reprogramar la espera, la corrida reintenta`() {
    assertEquals(WorkDecision.Retry, UploadPolicy.afterWaitFirst(EnqueueResult.Failed))
    assertEquals(WorkDecision.Success, UploadPolicy.afterWaitFirst(EnqueueResult.Enqueued))
    assertEquals(WorkDecision.Success, UploadPolicy.afterWaitFirst(EnqueueResult.AlreadyPending))
    assertEquals(WorkDecision.Success, UploadPolicy.afterWaitFirst(EnqueueResult.FollowOnly))
  }
}
