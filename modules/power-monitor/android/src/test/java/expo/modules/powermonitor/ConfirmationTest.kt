package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConfirmationTest {
  @Test
  fun `conserva el outageStart y pone at en la hora de ahora`() {
    val c = Confirmation.create(outageStart = 1_793_570_000_000L, answer = true, now = 1_793_570_500_000L)
    assertEquals(1_793_570_000_000L, c.outageStart)
    assertEquals(1_793_570_500_000L, c.at)
    assertTrue(c.answer)
    assertEquals(36, c.id.length)
    assertEquals('7', c.id[14])
  }

  @Test(expected = IllegalArgumentException::class)
  fun `rechaza outageStart cero`() {
    Confirmation.create(outageStart = 0L, answer = true, now = 1_793_570_500_000L)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `rechaza outageStart negativo`() {
    Confirmation.create(outageStart = -5L, answer = false, now = 1_793_570_500_000L)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `un outageStart en el futuro no guarda nada`() {
    Confirmation.create(outageStart = 1_793_570_500_000L + 6 * 60_000L, answer = true, now = 1_793_570_500_000L)
  }

  @Test
  fun `tolera hasta 5 minutos de reloj adelantado`() {
    Confirmation.create(outageStart = 1_793_570_500_000L + 4 * 60_000L, answer = true, now = 1_793_570_500_000L)
  }
}
