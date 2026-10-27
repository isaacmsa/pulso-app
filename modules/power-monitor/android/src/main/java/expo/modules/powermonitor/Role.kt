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

  /** Borra el rol: el teléfono vuelve a no haber elegido (solo lo hace el borrado de datos). */
  fun clear(store: KeyValueStore) = store.remove(KEY)

  fun store(context: Context): KeyValueStore =
    PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE))

  fun save(context: Context, role: String) = save(store(context), role)

  fun read(context: Context): String? = read(store(context))

  fun isFollowOnly(context: Context): Boolean = isFollowOnly(store(context))
}

/** Todo lo que `Arming` deja armado, uno por uno, para poder desarmarlo (y probar que no queda nada). */
interface Disarmer {
  fun cancelHeartbeat()
  fun cancelUpload()
  fun cancelTransitionCheck()
  fun cancelChargingJobs()
  fun disarmNetworkWatch()
  fun stopForegroundService()
}

object Disarming {
  /**
   * Desarma todo, uno por uno: latido, subida (con su cadena de reintentos), comprobación de transición, trabajo C,
   * pedido de red A y servicio D. Un paso que falla no impide los demás; devuelve las fallas.
   */
  fun all(disarmer: Disarmer): List<Throwable> {
    val steps = listOf<() -> Unit>(
      disarmer::cancelUpload,
      disarmer::cancelHeartbeat,
      disarmer::cancelTransitionCheck,
      disarmer::cancelChargingJobs,
      disarmer::disarmNetworkWatch,
      disarmer::stopForegroundService,
    )
    return steps.mapNotNull { step -> runCatching(step).exceptionOrNull() }
  }
}

object RoleChange {
  /**
   * Guarda el rol. Si es "follow", desarma lo que un rol anterior (o el registrador de la fase 0) haya dejado
   * andando: latido, subida (con su cadena de reintentos), comprobación de transición, trabajo C, pedido de red A y
   * servicio D. El rol se guarda primero, así un trabajo que despierte a media baja ya ve "follow" y termina solo.
   * Un paso que falla no impide los demás; devuelve las fallas para que el módulo las registre.
   */
  fun apply(store: KeyValueStore, role: String, disarmer: Disarmer): List<Throwable> {
    Role.save(store, role)
    if (role != Role.FOLLOW) return emptyList()
    return Disarming.all(disarmer)
  }
}
