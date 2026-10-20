package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HomeNetworkTest {
  @Test
  fun `misma red, misma huella`() {
    assertEquals(
      HomeNetwork.fingerprint("192.168.1.1", "192.168.1.0/24"),
      HomeNetwork.fingerprint("192.168.1.1", "192.168.1.0/24"),
    )
  }

  @Test
  fun `otro gateway, otra huella`() {
    assertNotEquals(
      HomeNetwork.fingerprint("192.168.1.1", "192.168.1.0/24"),
      HomeNetwork.fingerprint("192.168.0.1", "192.168.1.0/24"),
    )
  }

  @Test
  fun `sin gateway no hay huella`() {
    assertNull(HomeNetwork.fingerprint(null, "192.168.1.0/24"))
  }

  @Test
  fun `calcula la red IPv4`() {
    assertEquals("192.168.1.0/24", HomeNetwork.ipv4Network(byteArrayOf(192.toByte(), 168.toByte(), 1, 37), 24))
    assertEquals("10.0.0.0/16", HomeNetwork.ipv4Network(byteArrayOf(10, 0, 5, 9), 16))
  }
}
