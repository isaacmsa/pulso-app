package expo.modules.powermonitor

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EventJsonTest {
  private val snapshot = Snapshot(
    id = "0192f3a4-5b6c-7d8e-9f01-23456789abcd",
    at = 1_793_570_400_000L,
    source = "heartbeat",
    plugged = true,
    onWifi = true,
    homeWifi = null,
    internet = true,
    interactive = false,
    batteryPct = 80,
  )

  @Test
  fun `serializa todas las claves del snapshot`() {
    val json = JSONObject(EventJson.snapshot(snapshot))
    val keys = json.keys().asSequence().toSet()
    assertEquals(
      setOf("kind", "id", "at", "source", "plugged", "onWifi", "homeWifi", "internet", "interactive", "batteryPct"),
      keys,
    )
    assertEquals("snapshot", json.getString("kind"))
    assertEquals(1_793_570_400_000L, json.getLong("at"))
  }

  @Test
  fun `homeWifi null se serializa como null, no se omite`() {
    val json = JSONObject(EventJson.snapshot(snapshot))
    assertTrue(json.has("homeWifi"))
    assertTrue(json.isNull("homeWifi"))
  }
}
