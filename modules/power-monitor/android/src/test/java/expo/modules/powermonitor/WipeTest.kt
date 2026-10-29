package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private class WipeMemoryStore : KeyValueStore {
  val values = mutableMapOf<String, String>()
  override fun get(key: String): String? = values[key]
  override fun put(key: String, value: String) { values[key] = value }
  override fun remove(key: String) { values.remove(key) }
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    values.putAll(puts)
    removes.forEach { values.remove(it) }
  }
}

/** Un teléfono con una casa vigilada: eventos, token, huella, último estado, rol "watch", paso del onboarding y trabajos armados. */
private class FakePhone(failing: Set<String> = emptySet()) {
  val events = mutableListOf("e1", "e2", "e3")
  val roleStore = WipeMemoryStore().also {
    Role.save(it, Role.WATCH)
    OnboardingProgress.save(it, "battery")
  }
  val vaultStore = WipeMemoryStore().also { it.put(TokenVaultCore.KEY_TOKEN, "cifrado") }
  val homeStore = WipeMemoryStore().also { it.put("home.fingerprint", "huella") }
  val statusStore = WipeMemoryStore().also { it.put("last_status", "{}") }
  val running = mutableSetOf("heartbeat", "upload", "transition", "charging", "network", "fgs")
  val order = mutableListOf<String>()

  private val failures = failing

  private fun step(name: String, action: () -> Unit) {
    order += name
    if (name in failures) throw IllegalStateException("falla $name")
    action()
  }

  val disarmer = object : Disarmer {
    override fun cancelHeartbeat() = step("heartbeat") { running -= "heartbeat" }
    override fun cancelUpload() = step("upload") { running -= "upload" }
    override fun cancelTransitionCheck() = step("transition") { running -= "transition" }
    override fun cancelChargingJobs() = step("charging") { running -= "charging" }
    override fun disarmNetworkWatch() = step("network") { running -= "network" }
    override fun stopForegroundService() = step("fgs") { running -= "fgs" }
  }

  val data = LocalData(
    lockRole = { step("lock") { Role.save(roleStore, Role.FOLLOW) } },
    clearEvents = { step("events") { events.clear() } },
    clearToken = { step("token") { vaultStore.remove(TokenVaultCore.KEY_TOKEN) } },
    clearHomeFingerprint = { step("fingerprint") { homeStore.remove("home.fingerprint") } },
    clearLastServerStatus = { step("status") { statusStore.remove("last_status") } },
    clearOnboarding = { step("onboarding") { OnboardingProgress.save(roleStore, null) } },
  )
}

class WipeTest {
  @Test
  fun `wipe deja el almacen vacio y sin trabajos`() {
    val phone = FakePhone()
    val failures = Wipe.run(phone.disarmer, phone.data)
    assertTrue(failures.isEmpty())
    assertTrue(phone.events.isEmpty())
    assertTrue(phone.running.isEmpty())
    assertNull(phone.vaultStore.get(TokenVaultCore.KEY_TOKEN))
    assertNull(phone.homeStore.get("home.fingerprint"))
    assertNull(phone.statusStore.get("last_status"))
    // El rol queda en "follow": sin rol, todo lo nativo vigila (registrador de la fase 0) y se volvería a armar solo.
    assertEquals(Role.FOLLOW, Role.read(phone.roleStore))
    assertNull(OnboardingProgress.read(phone.roleStore))
  }

  @Test
  fun `primero se cierra el token y se cancelan los trabajos, y despues se borran los datos`() {
    val phone = FakePhone()
    Wipe.run(phone.disarmer, phone.data)
    val lastWork = phone.order.indexOfLast { it in setOf("heartbeat", "upload", "transition", "charging", "network", "fgs") }
    val firstData = phone.order.indexOfFirst { it in setOf("events", "fingerprint", "status", "onboarding") }
    assertEquals(listOf("token", "lock"), phone.order.take(2))
    assertTrue(lastWork < firstData)
  }

  @Test
  fun `si un paso falla los demas se ejecutan igual y se reportan las fallas`() {
    val phone = FakePhone(failing = setOf("upload", "events"))
    val failures = Wipe.run(phone.disarmer, phone.data)
    assertEquals(2, failures.size)
    assertEquals(3, phone.events.size)
    assertTrue("upload" in phone.running)
    assertTrue("heartbeat" !in phone.running)
    assertEquals(Role.FOLLOW, Role.read(phone.roleStore))
    assertNull(phone.vaultStore.get(TokenVaultCore.KEY_TOKEN))
  }

  // Sin rol, cada guardia nativa cuenta como "vigilar": el BootReceiver (reinicio o actualización de la app) volvía a
  // armar todo, y un onStopJob tardío de C grababa en el almacén recién vaciado y reagendaba el otro id.
  @Test
  fun `despues de borrar, un arranque o un onStopJob tardio no arma nada`() {
    val phone = FakePhone()
    Wipe.run(phone.disarmer, phone.data)
    val followOnly = Role.isFollowOnly(phone.roleStore)
    assertFalse(BootRearm.shouldRearm(followOnly))
    assertFalse(ChargingJob.shouldRecord(followOnly))
    assertFalse(ChargingJob.shouldRescheduleOnStop(followOnly))
    assertFalse(PowerWatchService.shouldRun(followOnly))
  }

  @Test
  fun `wipe es idempotente`() {
    val phone = FakePhone()
    Wipe.run(phone.disarmer, phone.data)
    val failures = Wipe.run(phone.disarmer, phone.data)
    assertTrue(failures.isEmpty())
    assertTrue(phone.events.isEmpty())
  }
}
