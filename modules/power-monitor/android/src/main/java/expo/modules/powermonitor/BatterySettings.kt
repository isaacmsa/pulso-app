package expo.modules.powermonitor

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings

/**
 * Abre las pantallas del fabricante donde se le quita a Pulso el cierre en segundo plano (el "Inicio automático"
 * de MIUI y la batería sin restricciones). Solo se pide `ACTION_APPLICATION_DETAILS_SETTINGS`, que no necesita
 * permiso: nunca `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Cada lista termina en los detalles de la app, así que un
 * fabricante desconocido o una pantalla que ya no existe nunca rompe nada.
 */
object BatterySettings {
  enum class Kind {
    AUTOSTART,
    BATTERY;

    companion object {
      fun parse(value: String): Kind = when (value) {
        "autostart" -> AUTOSTART
        "battery" -> BATTERY
        else -> throw IllegalArgumentException("tipo desconocido: $value")
      }
    }
  }

  sealed interface Target {
    data class Component(val packageName: String, val className: String) : Target
    data object AppDetails : Target
  }

  private val XIAOMI_FAMILY = setOf("xiaomi", "redmi", "poco")

  private val MIUI_AUTOSTART = Target.Component(
    "com.miui.securitycenter",
    "com.miui.permcenter.autostart.AutoStartManagementActivity",
  )

  private val MIUI_BATTERY = Target.Component(
    "com.miui.powerkeeper",
    "com.miui.powerkeeper.ui.HiddenAppsConfigActivity",
  )

  /** Lo que hay que probar, en orden. Siempre termina en `AppDetails`. */
  fun targets(manufacturer: String, kind: Kind): List<Target> {
    val specific = if (manufacturer.trim().lowercase() in XIAOMI_FAMILY) {
      when (kind) {
        Kind.AUTOSTART -> listOf(MIUI_AUTOSTART)
        Kind.BATTERY -> listOf(MIUI_BATTERY)
      }
    } else {
      emptyList()
    }
    return specific + Target.AppDetails
  }

  /** Abre la primera pantalla que el teléfono acepte. Devuelve si se abrió alguna. */
  fun open(context: Context, manufacturer: String, kind: Kind): Boolean {
    for (target in targets(manufacturer, kind)) {
      val opened = try {
        context.startActivity(intentFor(context, target).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } catch (_: ActivityNotFoundException) {
        false
      } catch (_: SecurityException) {
        false
      } catch (_: RuntimeException) {
        false
      }
      if (opened) return true
    }
    return false
  }

  private fun intentFor(context: Context, target: Target): Intent = when (target) {
    is Target.Component -> Intent().setComponent(ComponentName(target.packageName, target.className))
      // MIUI lee estos extras para saber de qué app se trata.
      .putExtra("package_name", context.packageName)
      .putExtra("package_label", context.applicationInfo.loadLabel(context.packageManager).toString())
    Target.AppDetails -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
  }
}
