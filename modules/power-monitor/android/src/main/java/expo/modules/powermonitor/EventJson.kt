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
  /** Si el teléfono tiene el bloqueo puesto. MIUI enciende la pantalla al desenchufar; esto dice si alguien lo usa. */
  val locked: Boolean? = null,
)

data class Report(val id: String, val at: Long, val value: String)

/** La respuesta Sí/No a "¿Se fue la luz?". `outageStart` es la hora del corte que dio el servidor y nunca se reescribe. */
data class Confirmation(val id: String, val at: Long, val outageStart: Long, val answer: Boolean) {
  companion object {
    /** Cuánto en el futuro se tolera un `outageStart` (relojes desfasados). JS exige lo mismo. */
    const val FUTURE_TOLERANCE_MS = 5 * 60_000L

    fun create(outageStart: Long, answer: Boolean, now: Long): Confirmation {
      require(outageStart > 0) { "outageStart inválido: $outageStart" }
      require(outageStart <= now + FUTURE_TOLERANCE_MS) { "outageStart en el futuro: $outageStart" }
      return Confirmation(UuidV7.generate(now), now, outageStart, answer)
    }
  }
}

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
      .put("locked", s.locked ?: JSONObject.NULL)
      .put("batteryPct", s.batteryPct ?: JSONObject.NULL)
      .toString()

  fun report(r: Report): String =
    JSONObject()
      .put("kind", "report")
      .put("id", r.id)
      .put("at", r.at)
      .put("value", r.value)
      .toString()

  fun confirmation(c: Confirmation): String =
    JSONObject()
      .put("kind", "confirmation")
      .put("id", c.id)
      .put("at", c.at)
      .put("outageStart", c.outageStart)
      .put("answer", c.answer)
      .toString()
}
