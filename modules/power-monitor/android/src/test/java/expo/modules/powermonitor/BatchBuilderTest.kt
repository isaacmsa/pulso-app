package expo.modules.powermonitor

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

internal fun snapshotEvent(
  n: Int,
  plugged: Boolean = true,
  onWifi: Boolean = true,
  homeWifi: Boolean? = true,
  internet: Boolean? = true,
  source: String = "heartbeat",
): Event {
  val id = "0192f3a4-5b6c-7d8e-9f01-%012d".format(n)
  val at = 1_793_570_400_000L + n * 1_000L
  val json = EventJson.snapshot(Snapshot(id, at, source, plugged, onWifi, homeWifi, internet, false, 80))
  return Event(id, at, "snapshot", json)
}

internal fun reportEvent(n: Int, value: String = "sin_luz"): Event {
  val id = "0192f3a4-5b6c-7d8e-9f01-%012d".format(n)
  val at = 1_793_570_400_000L + n * 1_000L
  return Event(id, at, "report", EventJson.report(Report(id, at, value)))
}

internal fun confirmationEvent(n: Int): Event {
  val id = "0192f3a4-5b6c-7d8e-9f01-%012d".format(n)
  val at = 1_793_570_400_000L + n * 1_000L
  val json = JSONObject()
    .put("kind", "confirmation")
    .put("id", id)
    .put("at", at)
    .put("outageStart", at - 3_600_000L)
    .put("answer", true)
    .toString()
  return Event(id, at, "confirmation", json)
}

/** El diagnóstico nativo completo: trae campos que el contrato del lote no acepta. */
internal fun fullDiagnostics(): JSONObject =
  JSONObject()
    .put("appVersion", "0.2.0")
    .put("manufacturer", "Xiaomi")
    .put("model", "25028RN03L")
    .put("sdkInt", 35)
    .put("standbyBucket", JSONObject.NULL)
    .put("ignoringBatteryOptimizations", false)
    .put("pendingEvents", 3)
    .put("storedEvents", 10)
    .put("homeNetworkLearned", true)
    .put("armed", JSONObject().put("heartbeat", true))

class BatchBuilderTest {
  private val sentAt = 1_793_570_500_000L

  @Test
  fun `salta el snapshot que repite (plugged, onWifi, homeWifi, internet)`() {
    val lastSent = SnapshotState(plugged = true, onWifi = true, homeWifi = true, internet = true)
    val pending = listOf(
      snapshotEvent(1), // igual al último enviado
      snapshotEvent(2, plugged = false), // cambia
      snapshotEvent(3, plugged = false, source = "transition_check"), // igual al anterior del lote
      snapshotEvent(4, plugged = false, internet = null), // cambia internet
    )

    val batch = BatchBuilder.build(pending, lastSent, fullDiagnostics(), sentAt)

    assertEquals(listOf(pending[1].id, pending[3].id), batch.events.map { it.id })
    assertEquals(listOf(pending[0].id, pending[2].id), batch.skippedIds)
  }

  @Test
  fun `sin un último enviado el primer snapshot viaja`() {
    val batch = BatchBuilder.build(listOf(snapshotEvent(1), snapshotEvent(2)), null, fullDiagnostics(), sentAt)

    assertEquals(listOf(snapshotEvent(1).id), batch.events.map { it.id })
    assertEquals(listOf(snapshotEvent(2).id), batch.skippedIds)
  }

  @Test
  fun `reportes y confirmaciones siempre viajan`() {
    val lastSent = SnapshotState(plugged = true, onWifi = true, homeWifi = true, internet = true)
    val pending = listOf(reportEvent(1), reportEvent(2, "hay_luz"), confirmationEvent(3), snapshotEvent(4))

    val batch = BatchBuilder.build(pending, lastSent, fullDiagnostics(), sentAt)

    assertEquals(pending.take(3).map { it.id }, batch.events.map { it.id })
    assertEquals(listOf(pending[3].id), batch.skippedIds)
    val sent = JSONObject(batch.json).getJSONArray("events")
    assertEquals("confirmation", sent.getJSONObject(2).getString("kind"))
    assertEquals(pending[2].json, sent.getJSONObject(2).toString())
  }

  @Test
  fun `lote vacío igual se construye (latido)`() {
    val batch = BatchBuilder.build(emptyList(), null, fullDiagnostics(), sentAt)

    assertTrue(batch.events.isEmpty())
    assertTrue(batch.skippedIds.isEmpty())
    val json = JSONObject(batch.json)
    assertEquals(0, json.getJSONArray("events").length())
    assertEquals(sentAt, json.getLong("sentAt"))
  }

  @Test
  fun `corta en 200`() {
    val pending = (1..250).map { reportEvent(it) }

    val batch = BatchBuilder.build(pending, null, fullDiagnostics(), sentAt)

    assertEquals(200, batch.events.size)
    assertEquals(pending.take(200).map { it.id }, batch.events.map { it.id })
    assertTrue(batch.skippedIds.isEmpty())
    assertEquals(200, JSONObject(batch.json).getJSONArray("events").length())
  }

  @Test
  fun `el JSON tiene exactamente sentAt, diagnostics y events`() {
    val pending = listOf(snapshotEvent(1, homeWifi = null))

    val json = JSONObject(BatchBuilder.build(pending, null, fullDiagnostics(), sentAt).json)

    assertEquals(setOf("sentAt", "diagnostics", "events"), json.keys().asSequence().toSet())
    val diagnostics = json.getJSONObject("diagnostics")
    assertEquals(
      setOf(
        "appVersion", "manufacturer", "model", "sdkInt", "standbyBucket",
        "ignoringBatteryOptimizations", "pendingEvents",
      ),
      diagnostics.keys().asSequence().toSet(),
    )
    assertTrue(diagnostics.isNull("standbyBucket"))
    assertEquals(3, diagnostics.getInt("pendingEvents"))
    // El evento sale tal cual se guardó: mismo id, mismo at y los null escritos.
    val event = json.getJSONArray("events").getJSONObject(0)
    assertEquals(pending[0].json, event.toString())
    assertTrue(event.has("homeWifi") && event.isNull("homeWifi"))
  }
}
