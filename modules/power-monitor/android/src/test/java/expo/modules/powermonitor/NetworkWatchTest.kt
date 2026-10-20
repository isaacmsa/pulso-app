package expo.modules.powermonitor

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkWatchTest {
  // El PendingIntent de registerNetworkCallback dispara una sola vez, cuando una red que cumple el
  // pedido queda disponible, y el sistema lo libera. Con Wi-Fi conectado dispararía al instante.
  @Test
  fun `solo se arma para la vuelta del Wi-Fi cuando no hay Wi-Fi`() {
    assertTrue(NetworkWatch.shouldArmForWifiReturn(onWifi = false))
    assertFalse(NetworkWatch.shouldArmForWifiReturn(onWifi = true))
  }
}
