package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChargingJobTest {
  // jobFinished es asíncrono: si se reagenda el mismo id, el trabajo viejo todavía figura como
  // pendiente y el nuevo no se crea. Por eso C alterna entre dos ids y agenda el otro antes de terminar.
  @Test
  fun `alterna entre dos ids`() {
    assertEquals(ChargingJob.SECONDARY_ID, ChargingJob.nextId(ChargingJob.PRIMARY_ID))
    assertEquals(ChargingJob.PRIMARY_ID, ChargingJob.nextId(ChargingJob.SECONDARY_ID))
    assertNotEquals(ChargingJob.PRIMARY_ID, ChargingJob.SECONDARY_ID)
  }

  @Test
  fun `los ids quedan fuera del rango que reparte WorkManager`() {
    assertTrue(ChargingJob.PRIMARY_ID > 1_000_000_000)
    assertTrue(ChargingJob.SECONDARY_ID > 1_000_000_000)
  }

  // Devolver true en onStopJob usa el backoff exponencial del sistema (30 s que se duplican con
  // cada parada): tras unos cuantos cortes, C tardaba 16 min o más en volver a arrancar.
  @Test
  fun `al detenerse no pide reintento con backoff`() {
    assertEquals(false, ChargingJob.RETRY_ON_STOP)
  }
}
