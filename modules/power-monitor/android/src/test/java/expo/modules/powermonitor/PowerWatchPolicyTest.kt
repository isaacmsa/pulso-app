package expo.modules.powermonitor

import android.app.Service
import org.junit.Assert.assertEquals
import org.junit.Test

class PowerWatchPolicyTest {
  @Test
  fun `en follow, PowerWatchService se detiene al arrancar`() {
    assertEquals(false, PowerWatchService.shouldRun(followOnly = true))
    assertEquals(true, PowerWatchService.shouldRun(followOnly = false))
  }

  @Test
  fun `en follow, el sistema no lo revive aunque el proceso muera`() {
    assertEquals(Service.START_NOT_STICKY, PowerWatchService.startMode(followOnly = true))
    assertEquals(Service.START_STICKY, PowerWatchService.startMode(followOnly = false))
  }
}
