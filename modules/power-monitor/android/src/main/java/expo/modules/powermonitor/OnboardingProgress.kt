package expo.modules.powermonitor

import android.content.Context

/**
 * Qué paso del onboarding falta, para retomarlo si el sistema mata la app (en MIUI es habitual mientras la persona
 * está en los ajustes de batería). Sin marca no hay nada pendiente: los teléfonos registrados antes de que existiera
 * la marca cuentan como terminados. Pasos: "role" (registro), "notifications", "battery", "home".
 */
object OnboardingProgress {
  private const val KEY = "onboarding_step"
  private val STEPS = setOf("role", "notifications", "battery", "home")

  /** `null` borra la marca: onboarding terminado. */
  fun save(store: KeyValueStore, step: String?) {
    if (step == null) {
      store.remove(KEY)
      return
    }
    require(step in STEPS) { "paso desconocido: $step" }
    store.put(KEY, step)
  }

  fun read(store: KeyValueStore): String? = store.get(KEY)?.takeIf { it in STEPS }

  fun save(context: Context, step: String?) = save(Role.store(context), step)

  fun read(context: Context): String? = read(Role.store(context))
}
