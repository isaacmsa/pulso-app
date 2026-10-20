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
}
