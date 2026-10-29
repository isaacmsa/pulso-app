package expo.modules.powermonitor

import android.content.Context

/** Todo lo que este teléfono guarda de la persona, una cosa por función, para poder borrarlo (y probarlo) sin Android. */
class LocalData(
  /**
   * Marca el teléfono como "follow" para que un trabajo que despierte a media baja (o después) no arme ni suba nada.
   * El rol queda así: sin rol, todo lo nativo cuenta como "vigilar" (registrador de la fase 0).
   */
  val lockRole: () -> Unit,
  val clearEvents: () -> Unit,
  val clearToken: () -> Unit,
  val clearHomeFingerprint: () -> Unit,
  val clearLastServerStatus: () -> Unit,
  val clearOnboarding: () -> Unit,
  /** Los exportes del registrador en el caché: cada uno lleva 14 días de eventos. */
  val clearExports: () -> Unit,
)

/**
 * "Borrar mis datos" en el teléfono: deja el almacén de eventos, la bóveda del token, la huella de la red de casa,
 * el último estado del servidor, el paso del onboarding y los exportes vacíos, cancela todos los trabajos y deja el rol en
 * "follow". JS lo llama solo después de que el servidor confirmó el borrado (204).
 *
 * El rol no se borra: sin rol, el arranque, una actualización de la app o un onStopJob tardío de C volverían a armar
 * la detección. Sin token la app ya vuelve al onboarding, y `register()` guarda el rol nuevo antes que nada.
 *
 * Orden: primero el token (nada nuevo sale a la red), después el rol "follow" (nada nuevo se arma) y los trabajos
 * cancelados, y recién entonces se vacían los datos. Cada paso va por su cuenta: uno que
 * falla no impide los demás. Devuelve las fallas; con alguna, JS lo dice y la persona puede repetirlo, porque
 * borrar dos veces da lo mismo.
 */
object Wipe {
  fun run(disarmer: Disarmer, data: LocalData): List<Throwable> {
    val failures = mutableListOf<Throwable>()
    fun attempt(step: () -> Unit) { runCatching(step).exceptionOrNull()?.let(failures::add) }
    attempt(data.clearToken)
    attempt(data.lockRole)
    failures += Disarming.all(disarmer)
    attempt(data.clearEvents)
    attempt(data.clearHomeFingerprint)
    attempt(data.clearLastServerStatus)
    attempt(data.clearOnboarding)
    attempt(data.clearExports)
    return failures
  }

  fun androidData(context: Context): LocalData {
    val app = context.applicationContext
    val roleStore = Role.store(app)
    return LocalData(
      lockRole = { Role.save(roleStore, Role.FOLLOW) },
      clearEvents = { EventStore.get(app).clear() },
      clearToken = { TokenVault.clear(app) },
      clearHomeFingerprint = { HomeNetwork(app).forget() },
      clearLastServerStatus = { LastServerStatus.clear(app) },
      clearOnboarding = { OnboardingProgress.save(roleStore, null) },
      clearExports = { Exporter.clearExports(app.cacheDir) },
    )
  }

  fun run(context: Context): List<Throwable> =
    run(Arming.androidDisarmer(context), androidData(context))
}
