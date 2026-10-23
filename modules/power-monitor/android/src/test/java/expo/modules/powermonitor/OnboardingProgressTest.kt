package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

private class ProgressMemoryStore : KeyValueStore {
  val values = mutableMapOf<String, String>()
  override fun get(key: String): String? = values[key]
  override fun put(key: String, value: String) { values[key] = value }
  override fun remove(key: String) { values.remove(key) }
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    values.putAll(puts)
    removes.forEach { values.remove(it) }
  }
}

class OnboardingProgressTest {
  private val store = ProgressMemoryStore()

  @Test
  fun `sin marca el onboarding no esta pendiente (telefonos ya registrados)`() {
    assertNull(OnboardingProgress.read(store))
  }

  @Test
  fun `el paso se guarda y se lee`() {
    for (step in listOf("role", "notifications", "battery", "home")) {
      OnboardingProgress.save(store, step)
      assertEquals(step, OnboardingProgress.read(store))
    }
  }

  @Test
  fun `null borra la marca`() {
    OnboardingProgress.save(store, "battery")
    OnboardingProgress.save(store, null)
    assertNull(OnboardingProgress.read(store))
  }

  @Test
  fun `un paso desconocido se rechaza y no pisa el guardado`() {
    OnboardingProgress.save(store, "battery")
    try {
      OnboardingProgress.save(store, "otro")
      fail("debía lanzar")
    } catch (_: IllegalArgumentException) {
    }
    assertEquals("battery", OnboardingProgress.read(store))
  }

  @Test
  fun `un valor corrupto se lee como sin marca`() {
    store.put("onboarding_step", "???")
    assertNull(OnboardingProgress.read(store))
  }
}
