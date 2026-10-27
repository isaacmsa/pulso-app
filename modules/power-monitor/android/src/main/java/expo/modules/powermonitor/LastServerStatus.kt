package expo.modules.powermonitor

import android.content.Context
import org.json.JSONObject

/**
 * El último `HomeStatus` que devolvió `POST /v1/events`, tal cual llegó, con la hora en que llegó:
 * `{ status, receivedAt }`. Así la app sin red muestra "el último estado del servidor" y "hace 20 min"
 * (D-016, D-027). JS lo valida con `zHomeStatus` al leerlo.
 */
object LastServerStatus {
  private const val PREFS = "pulso_status"
  private const val KEY = "last_status"

  private fun store(context: Context) =
    PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE))

  fun encode(statusJson: String, receivedAt: Long): String =
    JSONObject().put("status", JSONObject(statusJson)).put("receivedAt", receivedAt).toString()

  fun save(context: Context, statusJson: String, receivedAt: Long) =
    store(context).put(KEY, encode(statusJson, receivedAt))

  fun read(context: Context): String? = store(context).get(KEY)

  fun clear(context: Context) = store(context).remove(KEY)
}
