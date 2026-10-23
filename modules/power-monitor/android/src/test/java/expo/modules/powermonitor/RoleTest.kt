package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private class RoleMemoryStore : KeyValueStore {
  val values = mutableMapOf<String, String>()
  override fun get(key: String): String? = values[key]
  override fun put(key: String, value: String) { values[key] = value }
  override fun remove(key: String) { values.remove(key) }
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    values.putAll(puts)
    removes.forEach { values.remove(it) }
  }
}

class RoleTest {
  private val store = RoleMemoryStore()

  @Test
  fun `sin rol guardado no es solo seguir`() {
    assertNull(Role.read(store))
    assertFalse(Role.isFollowOnly(store))
  }

  @Test
  fun `watch y follow se guardan y se leen`() {
    Role.save(store, "follow")
    assertEquals("follow", Role.read(store))
    assertTrue(Role.isFollowOnly(store))
    Role.save(store, "watch")
    assertEquals("watch", Role.read(store))
    assertFalse(Role.isFollowOnly(store))
  }

  @Test
  fun `un rol desconocido se rechaza y no pisa el guardado`() {
    Role.save(store, "watch")
    try {
      Role.save(store, "admin")
      fail("debía lanzar")
    } catch (_: IllegalArgumentException) {
    }
    assertEquals("watch", Role.read(store))
  }

  @Test
  fun `un valor corrupto guardado se lee como sin rol`() {
    store.put("role", "???")
    assertNull(Role.read(store))
    assertFalse(Role.isFollowOnly(store))
  }
}
