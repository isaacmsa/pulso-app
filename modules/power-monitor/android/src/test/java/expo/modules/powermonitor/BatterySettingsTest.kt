package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BatterySettingsTest {
  private val miuiAutostart = BatterySettings.Target.Component(
    "com.miui.securitycenter",
    "com.miui.permcenter.autostart.AutoStartManagementActivity",
  )

  @Test
  fun `en Xiaomi, Redmi y Poco el inicio automatico abre la pantalla de MIUI primero`() {
    for (maker in listOf("Xiaomi", "xiaomi", "Redmi", "POCO")) {
      val targets = BatterySettings.targets(maker, BatterySettings.Kind.AUTOSTART)
      assertEquals(maker, miuiAutostart, targets.first())
    }
  }

  @Test
  fun `todas las listas terminan en los detalles de la app`() {
    for (maker in listOf("Xiaomi", "samsung", "TECNO", "", "Fairphone")) {
      for (kind in BatterySettings.Kind.entries) {
        assertEquals(BatterySettings.Target.AppDetails, BatterySettings.targets(maker, kind).last())
      }
    }
  }

  @Test
  fun `un fabricante desconocido solo abre los detalles de la app`() {
    assertEquals(
      listOf(BatterySettings.Target.AppDetails),
      BatterySettings.targets("Fairphone", BatterySettings.Kind.AUTOSTART),
    )
    assertEquals(
      listOf(BatterySettings.Target.AppDetails),
      BatterySettings.targets("Samsung", BatterySettings.Kind.BATTERY),
    )
  }

  @Test
  fun `la bateria en Xiaomi prueba primero la pantalla de ahorro de MIUI`() {
    val targets = BatterySettings.targets("Xiaomi", BatterySettings.Kind.BATTERY)
    assertTrue(targets.first() is BatterySettings.Target.Component)
    assertTrue(targets.size >= 2)
  }

  @Test
  fun `kind se lee del texto de JS y rechaza lo desconocido`() {
    assertEquals(BatterySettings.Kind.AUTOSTART, BatterySettings.Kind.parse("autostart"))
    assertEquals(BatterySettings.Kind.BATTERY, BatterySettings.Kind.parse("battery"))
    var failed = false
    try {
      BatterySettings.Kind.parse("otro")
    } catch (_: IllegalArgumentException) {
      failed = true
    }
    assertTrue(failed)
  }
}
