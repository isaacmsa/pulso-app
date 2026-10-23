package expo.modules.powermonitor

import android.content.Context

/**
 * Lo que eligió la persona en el onboarding: "watch" (este teléfono vigila su casa) o "follow" (solo sigue una).
 * Vive en el nativo para que el arranque, el latido y la subida lo sepan sin que JS esté vivo. Un teléfono
 * "follow" nunca arma la detección ni encola subidas. Sin rol guardado (el registrador de la fase 0) cuenta como
 * vigilar, para no apagarle nada a quien ya tenía el registrador andando.
 */
object Role {
  const val WATCH = "watch"
  const val FOLLOW = "follow"
  private const val PREFS = "pulso_role"
  private const val KEY = "role"

  fun save(store: KeyValueStore, role: String) {
    require(role == WATCH || role == FOLLOW) { "rol desconocido: $role" }
    store.put(KEY, role)
  }

  /** El rol guardado, o null si no hay (o si el valor guardado no es uno de los dos). */
  fun read(store: KeyValueStore): String? = store.get(KEY)?.takeIf { it == WATCH || it == FOLLOW }

  fun isFollowOnly(store: KeyValueStore): Boolean = read(store) == FOLLOW

  private fun store(context: Context) =
    PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE))

  fun save(context: Context, role: String) = save(store(context), role)

  fun read(context: Context): String? = read(store(context))

  fun isFollowOnly(context: Context): Boolean = isFollowOnly(store(context))
}
