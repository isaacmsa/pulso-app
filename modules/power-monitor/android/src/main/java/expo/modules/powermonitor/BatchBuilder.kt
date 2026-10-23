package expo.modules.powermonitor

import org.json.JSONArray
import org.json.JSONObject

/** Un evento guardado en `EventStore`, con su JSON tal cual se escribió (regla 4: nunca se reescribe). */
data class Event(val id: String, val at: Long, val kind: String, val json: String)

/** Lo único que el servidor necesita saber de un snapshot para decidir si viaja (regla 6, D-008). */
data class SnapshotState(val plugged: Boolean, val onWifi: Boolean, val homeWifi: Boolean?, val internet: Boolean?) {
  companion object {
    fun of(s: Snapshot) = SnapshotState(s.plugged, s.onWifi, s.homeWifi, s.internet)

    /** null si el JSON no es un snapshot legible. */
    fun fromJson(json: String): SnapshotState? = runCatching {
      val o = JSONObject(json)
      SnapshotState(
        plugged = o.getBoolean("plugged"),
        onWifi = o.getBoolean("onWifi"),
        homeWifi = if (o.isNull("homeWifi")) null else o.getBoolean("homeWifi"),
        internet = if (o.isNull("internet")) null else o.getBoolean("internet"),
      )
    }.getOrNull()
  }
}

/**
 * `events` son los que viajan y `json` el cuerpo de `POST /v1/events`. `skippedIds` son snapshots que repiten el
 * estado: se marcan como subidos sin enviarse.
 */
data class Batch(val events: List<Event>, val json: String, val skippedIds: List<String>)

/** Arma el lote con la forma exacta de `eventBatchSchema` (pulso-api/docs/api.md). */
object BatchBuilder {
  const val MAX_EVENTS = 200

  /** Los campos de `diagnosticsSchema`. El diagnóstico nativo trae más (armed, storedEvents…) que no viajan. */
  val DIAGNOSTICS_FIELDS = listOf(
    "appVersion", "manufacturer", "model", "sdkInt", "standbyBucket", "ignoringBatteryOptimizations", "pendingEvents",
  )

  /**
   * `pending` va en orden de `at` y luego de `id`. `lastSent` es el estado del último snapshot que el servidor ya
   * tiene; null si no hay ninguno, y entonces el primer snapshot viaja.
   */
  fun build(pending: List<Event>, lastSent: SnapshotState?, diagnostics: JSONObject, sentAt: Long): Batch {
    val events = mutableListOf<Event>()
    val skipped = mutableListOf<String>()
    var current = lastSent
    for (event in pending) {
      if (events.size == MAX_EVENTS) break
      if (event.kind == "snapshot") {
        val state = SnapshotState.fromJson(event.json)
        if (state != null && state == current) {
          skipped += event.id
          continue
        }
        current = state
      }
      events += event
    }
    val array = JSONArray()
    events.forEach { array.put(JSONObject(it.json)) }
    val json = JSONObject()
      .put("sentAt", sentAt)
      .put("diagnostics", contractDiagnostics(diagnostics))
      .put("events", array)
    return Batch(events, json.toString(), skipped)
  }

  private fun contractDiagnostics(full: JSONObject): JSONObject {
    val out = JSONObject()
    DIAGNOSTICS_FIELDS.forEach { key -> out.put(key, full.opt(key) ?: JSONObject.NULL) }
    return out
  }
}
