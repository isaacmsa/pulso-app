package expo.modules.powermonitor

import android.content.Context

/** Dónde está la API y qué versión de la app sube los lotes. Lo lee el trabajo de subida en Kotlin. No es secreto. */
data class ApiConfig(val apiUrl: String, val appVersion: String) {
  companion object {
    const val PREFS = "pulso_api"
    private const val KEY_URL = "api_url"
    private const val KEY_VERSION = "app_version"

    fun save(store: KeyValueStore, apiUrl: String, appVersion: String) {
      store.put(KEY_URL, apiUrl.trim().trimEnd('/'))
      store.put(KEY_VERSION, appVersion)
    }

    fun read(store: KeyValueStore): ApiConfig? {
      val url = store.get(KEY_URL)?.takeIf { it.isNotEmpty() } ?: return null
      return ApiConfig(url, store.get(KEY_VERSION).orEmpty())
    }

    private fun store(context: Context) =
      PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE))

    fun save(context: Context, apiUrl: String, appVersion: String) = save(store(context), apiUrl, appVersion)

    fun read(context: Context): ApiConfig? = read(store(context))
  }
}
