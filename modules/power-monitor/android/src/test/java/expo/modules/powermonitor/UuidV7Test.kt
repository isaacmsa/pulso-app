package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UuidV7Test {
  @Test
  fun `tiene version 7 y variante RFC`() {
    val id = UuidV7.generate()
    assertEquals('7', id[14])
    assertTrue(id[19] in "89ab")
  }

  @Test
  fun `los primeros 12 hex son el timestamp`() {
    val id = UuidV7.generate(0x0192F3A45B6CL)
    assertTrue(id, id.startsWith("0192f3a4-5b6c-7"))
  }

  @Test
  fun `dos ids en el mismo ms son distintos`() {
    assertNotEquals(UuidV7.generate(1_793_570_400_000L), UuidV7.generate(1_793_570_400_000L))
  }
}
