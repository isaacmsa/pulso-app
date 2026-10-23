package expo.modules.powermonitor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private class MemoryStore : KeyValueStore {
  val values = mutableMapOf<String, String>()
  /** Cuántas escrituras atómicas (ediciones) recibió el almacén. */
  var writes = 0
  override fun get(key: String): String? = values[key]
  override fun put(key: String, value: String) = write(mapOf(key to value), emptySet())
  override fun remove(key: String) = write(emptyMap(), setOf(key))
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    writes += 1
    values.putAll(puts)
    removes.forEach { values.remove(it) }
  }
}

// Cifrador de mentira: reversible, con un prefijo para detectar datos que no son suyos.
private class FakeCipher(private val failOnDecrypt: Boolean = false) : TokenCipher {
  override fun encrypt(plain: ByteArray): ByteArray = "ok:".toByteArray() + plain.reversedArray()
  override fun decrypt(data: ByteArray): ByteArray {
    if (failOnDecrypt) throw IllegalStateException("la clave del Keystore no se puede leer")
    val prefix = "ok:".toByteArray()
    require(data.size >= prefix.size && data.copyOfRange(0, prefix.size).contentEquals(prefix)) { "texto cifrado corrupto" }
    return data.copyOfRange(prefix.size, data.size).reversedArray()
  }
}

class TokenVaultTest {
  private val store = MemoryStore()
  private val vault = TokenVaultCore(FakeCipher(), store)

  @Test
  fun `lo guardado se lee igual`() {
    vault.store("tok_abc123")
    assertEquals("tok_abc123", vault.read())
  }

  @Test
  fun `lo guardado no queda en claro`() {
    vault.store("tok_abc123")
    assertTrue(store.values.values.none { it.contains("tok_abc123") })
  }

  @Test
  fun `clear deja null`() {
    vault.store("tok_abc123")
    vault.clear()
    assertNull(vault.read())
  }

  @Test
  fun `sin token guardado read devuelve null`() {
    assertNull(vault.read())
  }

  @Test
  fun `un texto cifrado corrupto devuelve null sin lanzar`() {
    vault.store("tok_abc123")
    store.values[TokenVaultCore.KEY_TOKEN] = "cafebabe"
    assertNull(vault.read())
    store.values[TokenVaultCore.KEY_TOKEN] = "esto no es hexadecimal"
    assertNull(vault.read())
  }

  @Test
  fun `una clave que el Keystore no puede leer devuelve null sin lanzar`() {
    vault.store("tok_abc123")
    assertNull(TokenVaultCore(FakeCipher(failOnDecrypt = true), store).read())
  }

  @Test
  fun `markInvalid marca el token y guardar uno nuevo lo limpia`() {
    assertFalse(vault.isInvalid())
    vault.store("tok_viejo")
    vault.markInvalid("tok_viejo")
    assertTrue(vault.isInvalid())
    vault.store("tok_nuevo")
    assertFalse(vault.isInvalid())
  }

  @Test
  fun `markInvalid con un token viejo no marca el token nuevo`() {
    vault.store("tok_viejo")
    vault.store("tok_nuevo")
    vault.markInvalid("tok_viejo")
    assertFalse(vault.isInvalid())
    assertEquals("tok_nuevo", vault.read())
  }

  @Test
  fun `store deja token y marca consistentes en una sola escritura`() {
    vault.store("tok_viejo")
    vault.markInvalid("tok_viejo")
    val before = store.writes
    vault.store("tok_nuevo")
    assertEquals(1, store.writes - before)
    assertEquals("tok_nuevo", vault.read())
    assertFalse(vault.isInvalid())
  }

  @Test
  fun `clear tambien limpia la marca de invalido`() {
    vault.store("tok_abc123")
    vault.markInvalid("tok_abc123")
    vault.clear()
    assertFalse(vault.isInvalid())
  }

  @Test
  fun `ApiConfig guarda y lee la url y la version`() {
    val config = MemoryStore()
    assertNull(ApiConfig.read(config))
    ApiConfig.save(config, "https://api.example.test", "0.2.0")
    val read = ApiConfig.read(config)
    assertNotNull(read)
    assertEquals(ApiConfig("https://api.example.test", "0.2.0"), read)
  }
}
