package expo.modules.powermonitor

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SnapshotRecorderTest {
  @Test
  fun `programa el seguimiento solo al pasar de enchufado a desenchufado`() {
    assertTrue(SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged = true, nowPlugged = false))
    assertFalse(SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged = false, nowPlugged = false))
    assertFalse(SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged = true, nowPlugged = true))
    assertFalse(SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged = null, nowPlugged = false))
    assertFalse(SnapshotRecorder.shouldScheduleTransitionCheck(prevPlugged = false, nowPlugged = true))
  }

  @Test
  fun `encola la subida solo si cambia el estado, y el latido la encola por su cuenta`() {
    val casa = SnapshotState(plugged = true, onWifi = true, homeWifi = true, internet = true)
    val corte = casa.copy(plugged = false)
    assertTrue(SnapshotRecorder.shouldEnqueueUpload("network_callback", prev = casa, now = corte))
    assertTrue(SnapshotRecorder.shouldEnqueueUpload("app_open", prev = null, now = casa))
    assertTrue(SnapshotRecorder.shouldEnqueueUpload("app_open", prev = casa, now = casa.copy(internet = null)))
    assertFalse(SnapshotRecorder.shouldEnqueueUpload("app_open", prev = casa, now = casa))
    assertFalse(SnapshotRecorder.shouldEnqueueUpload("heartbeat", prev = casa, now = corte))
  }
}
