package expo.modules.powermonitor

import android.content.Context

/**
 * El último `HomeStatus` que devolvió `POST /v1/events`, tal cual llegó. Así la app sin red muestra "el último
 * estado del servidor" (D-016, D-027). JS lo valida con `zHomeStatus` al leerlo.
 */
object LastServerStatus {
  private const val PREFS = "pulso_status"
  private const val KEY = "last_status"

  private fun store(context: Context) =
    PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE))

  fun save(context: Context, json: String) = store(context).put(KEY, json)

  fun read(context: Context): String? = store(context).get(KEY)
}
