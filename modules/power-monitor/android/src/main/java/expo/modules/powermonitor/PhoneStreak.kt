package expo.modules.powermonitor

import org.json.JSONObject

/** La racha actual del teléfono: el snapshot más nuevo y desde cuándo está en ese mismo `plugged`. */
data class PhoneStreak(val newest: PhoneStreaks.Row, val since: Long)

/**
 * El estado crudo de "Este teléfono". Recorre todos los snapshots guardados (14 días), no los últimos 500 eventos:
 * el relevo de C y el latido llenan 500 en unos 2 días, y una racha más larga mostraba una fecha que avanzaba sola.
 */
object PhoneStreaks {
  data class Row(val at: Long, val json: String)

  /**
   * `newestFirst`: los snapshots del más nuevo al más viejo. `since` es el `at` del primer snapshot después del último
   * con otro `plugged`; si ninguno es distinto, el del más viejo guardado. Los snapshots ilegibles se saltan.
   */
  fun current(newestFirst: Sequence<Row>): PhoneStreak? {
    var newest: Row? = null
    var plugged = false
    var since = 0L
    for (row in newestFirst) {
      val rowPlugged = pluggedOf(row.json) ?: continue
      if (newest == null) {
        newest = row
        plugged = rowPlugged
      } else if (rowPlugged != plugged) {
        break
      }
      since = row.at
    }
    return newest?.let { PhoneStreak(it, since) }
  }

  /** `{ snapshot, since }` para JS: el snapshot tal como se guardó (el contrato de la API) y el inicio de la racha. */
  fun json(streak: PhoneStreak): String =
    JSONObject().put("snapshot", JSONObject(streak.newest.json)).put("since", streak.since).toString()

  private fun pluggedOf(json: String): Boolean? =
    runCatching { JSONObject(json).getBoolean("plugged") }.getOrNull()
}
