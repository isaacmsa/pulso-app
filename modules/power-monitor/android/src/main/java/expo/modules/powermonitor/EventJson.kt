package expo.modules.powermonitor

import org.json.JSONObject

data class Snapshot(
  val id: String,
  val at: Long,
  val source: String,
  val plugged: Boolean,
  val onWifi: Boolean,
  val homeWifi: Boolean?,
  val internet: Boolean?,
  val interactive: Boolean?,
  val batteryPct: Int?,
)

data class Report(val id: String, val at: Long, val value: String)

/** Serializa los eventos con la forma exacta de `pulso-api/docs/api.md`. Los null se escriben, no se omiten. */
object EventJson {
  fun snapshot(s: Snapshot): String =
    JSONObject()
      .put("kind", "snapshot")
      .put("id", s.id)
      .put("at", s.at)
      .put("source", s.source)
      .put("plugged", s.plugged)
      .put("onWifi", s.onWifi)
      .put("homeWifi", s.homeWifi ?: JSONObject.NULL)
      .put("internet", s.internet ?: JSONObject.NULL)
      .put("interactive", s.interactive ?: JSONObject.NULL)
      .put("batteryPct", s.batteryPct ?: JSONObject.NULL)
      .toString()

  fun report(r: Report): String =
    JSONObject()
      .put("kind", "report")
      .put("id", r.id)
      .put("at", r.at)
      .put("value", r.value)
      .toString()
}
