package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private class DisarmMemoryStore : KeyValueStore {
  val values = mutableMapOf<String, String>()
  override fun get(key: String): String? = values[key]
  override fun put(key: String, value: String) { values[key] = value }
  override fun remove(key: String) { values.remove(key) }
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    values.putAll(puts)
    removes.forEach { values.remove(it) }
  }
}

private class RecordingDisarmer(private val failing: Set<String> = emptySet()) : Disarmer {
  val calls = mutableListOf<String>()
  /** El rol guardado en el momento de cada llamada: un trabajo que despierte a media baja ya debe verlo. */
  var roleSeenAtFirstCall: String? = null
  var store: KeyValueStore? = null

  private fun record(name: String) {
    if (calls.isEmpty()) roleSeenAtFirstCall = store?.let { Role.read(it) }
    calls += name
    if (name in failing) throw IllegalStateException("falla $name")
  }

  override fun cancelHeartbeat() = record("heartbeat")
  override fun cancelUpload() = record("upload")
  override fun cancelTransitionCheck() = record("transition")
  override fun cancelChargingJobs() = record("charging")
  override fun disarmNetworkWatch() = record("network")
  override fun stopForegroundService() = record("fgs")
}

class DisarmTest {
  private val everything = setOf("heartbeat", "upload", "transition", "charging", "network", "fgs")

  @Test
  fun `un telefono que pasa a seguir no deja nada armado`() {
    val store = DisarmMemoryStore()
    val disarmer = RecordingDisarmer().also { it.store = store }
    val failures = RoleChange.apply(store, Role.FOLLOW, disarmer)
    assertTrue(failures.isEmpty())
    assertEquals(everything, disarmer.calls.toSet())
    assertEquals(everything.size, disarmer.calls.size)
    assertEquals(Role.FOLLOW, Role.read(store))
  }

  @Test
  fun `el rol se guarda antes de desarmar`() {
    val store = DisarmMemoryStore()
    val disarmer = RecordingDisarmer().also { it.store = store }
    RoleChange.apply(store, Role.FOLLOW, disarmer)
    assertEquals(Role.FOLLOW, disarmer.roleSeenAtFirstCall)
  }

  @Test
  fun `vigilar no desarma nada`() {
    val store = DisarmMemoryStore()
    val disarmer = RecordingDisarmer()
    RoleChange.apply(store, Role.WATCH, disarmer)
    assertTrue(disarmer.calls.isEmpty())
    assertEquals(Role.WATCH, Role.read(store))
  }

  @Test
  fun `si un paso falla los demas se ejecutan igual y se reporta la falla`() {
    val store = DisarmMemoryStore()
    val disarmer = RecordingDisarmer(failing = setOf("upload", "network"))
    val failures = RoleChange.apply(store, Role.FOLLOW, disarmer)
    assertEquals(everything, disarmer.calls.toSet())
    assertEquals(2, failures.size)
  }

  @Test
  fun `un rol desconocido no desarma ni guarda`() {
    val store = DisarmMemoryStore()
    val disarmer = RecordingDisarmer()
    try {
      RoleChange.apply(store, "admin", disarmer)
    } catch (_: IllegalArgumentException) {
    }
    assertTrue(disarmer.calls.isEmpty())
    assertEquals(null, Role.read(store))
  }
}
