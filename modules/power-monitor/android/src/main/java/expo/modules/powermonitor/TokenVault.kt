package expo.modules.powermonitor

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Almacén de pares clave-valor mínimo, para poder probar sin Android. */
interface KeyValueStore {
  fun get(key: String): String?
  fun put(key: String, value: String)
  fun remove(key: String)
  /** Aplica varias escrituras en una sola edición atómica: quien lea ve todo o nada. */
  fun write(puts: Map<String, String>, removes: Set<String> = emptySet())
}

class PrefsStore(private val prefs: SharedPreferences) : KeyValueStore {
  override fun get(key: String): String? = prefs.getString(key, null)
  override fun put(key: String, value: String) = write(mapOf(key to value))
  override fun remove(key: String) = write(emptyMap(), setOf(key))
  override fun write(puts: Map<String, String>, removes: Set<String>) {
    val editor = prefs.edit()
    removes.forEach { editor.remove(it) }
    puts.forEach { (key, value) -> editor.putString(key, value) }
    editor.apply()
  }
}

/** La clave o el texto cifrado no volverán a servir (clave invalidada o perdida, datos corruptos). Reintentar no ayuda. */
class PermanentKeyException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Lo que una excepción de keystore dice sobre si reintentar sirve. */
data class KeystoreFailure(val transient: Boolean, val permanentCode: Boolean)

private const val KS_KEY_PERMANENTLY_INVALIDATED = 17 // ResponseCode de keystore2
private const val KS_INVALID_KEY_BLOB = -33 // ErrorCode de KeyMint

/**
 * Lee una excepción de keystore de la cadena. API 33+: `android.security.KeyStoreException` trae `isTransientFailure`
 * y el código numérico. Antes de 33 no existe esa clase: cualquier `java.security.KeyStoreException` cuenta como
 * transitoria.
 */
fun probeKeystoreFailure(error: Throwable, sdkInt: Int): KeystoreFailure? {
  if (sdkInt >= 33 && error is android.security.KeyStoreException) {
    val code = error.numericErrorCode
    return KeystoreFailure(
      transient = error.isTransientFailure,
      permanentCode = code == KS_KEY_PERMANENTLY_INVALIDATED || code == KS_INVALID_KEY_BLOB,
    )
  }
  if (error is java.security.KeyStoreException) return KeystoreFailure(transient = true, permanentCode = false)
  return null
}

/**
 * Separa las fallas de `decrypt` que no tienen remedio de las que pueden pasar solas. Un hipo del daemon de keystore2
 * sale envuelto (`UnrecoverableKeyException` desde `getKey`, `IllegalBlockSizeException` desde `doFinal`) con un
 * `KeyStoreException` de causa: se recorre la cadena y, si hay uno, manda lo que diga (transitoria salvo que el código
 * sea permanente). Sin él, valen los tipos conocidos. Todo lo demás es transitorio: ante la duda, no se descarta el
 * token, porque registrar de nuevo crea otra casa y suelta a los seguidores (D-030).
 */
fun classifyDecryptFailure(
  error: Throwable,
  sdkInt: Int = android.os.Build.VERSION.SDK_INT,
  probe: (Throwable, Int) -> KeystoreFailure? = ::probeKeystoreFailure,
): Throwable {
  if (error is PermanentKeyException) return error
  var cause: Throwable? = error
  var depth = 0
  while (cause != null && depth < 10) {
    probe(cause, sdkInt)?.let { failure ->
      return if (failure.transient && !failure.permanentCode) error else PermanentKeyException("la clave de keystore ya no sirve", error)
    }
    if (cause is android.security.keystore.KeyPermanentlyInvalidatedException) {
      return PermanentKeyException("clave invalidada", error)
    }
    cause = cause.cause
    depth++
  }
  return when (error) {
    is java.security.UnrecoverableKeyException,
    is javax.crypto.AEADBadTagException,
    is javax.crypto.BadPaddingException,
    is IllegalArgumentException,
    -> PermanentKeyException("el token cifrado no se puede recuperar", error)
    else -> error
  }
}

/** Qué hay en la bóveda. Solo `ABSENT` y `UNREADABLE` justifican registrar de nuevo; `TRANSIENT` se reintenta más tarde. */
enum class TokenState(val wire: String) {
  PRESENT("present"),
  ABSENT("absent"),
  UNREADABLE("unreadable"),
  TRANSIENT("transient"),
}

/** Cifra y descifra bytes. `decrypt` lanza si los datos están corruptos o la clave no se puede usar (la bóveda clasifica la falla con `classifyDecryptFailure`). */
interface TokenCipher {
  fun encrypt(plain: ByteArray): ByteArray
  fun decrypt(data: ByteArray): ByteArray
}

/**
 * Un solo candado para toda la bóveda: JS (HandlerThread de Expo) y el UploadWorker (hilo de WorkManager)
 * la usan a la vez, y cada llamada crea su propio `TokenVaultCore`.
 */
internal object VaultLock

/** AES-256-GCM con una clave del Android Keystore que nunca sale del hardware. Formato: IV (12 bytes) + texto cifrado. */
class KeystoreCipher(private val alias: String = TokenVault.KEY_ALIAS) : TokenCipher {
  override fun encrypt(plain: ByteArray): ByteArray {
    val key = synchronized(VaultLock) {
      try {
        getOrCreateKey()
      } catch (_: Exception) {
        // Clave ilegible o inservible (por ejemplo, restaurada en otro teléfono): se descarta y se crea una nueva.
        keyStore().deleteEntry(alias)
        getOrCreateKey()
      }
    }
    val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key) }
    return cipher.iv + cipher.doFinal(plain)
  }

  override fun decrypt(data: ByteArray): ByteArray {
    if (data.size <= IV_SIZE) throw PermanentKeyException("texto cifrado demasiado corto")
    val key = keyStore().getKey(alias, null) as? SecretKey
      ?: throw PermanentKeyException("no hay clave en el Keystore")
    val cipher = Cipher.getInstance(TRANSFORMATION).apply {
      init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, data, 0, IV_SIZE))
    }
    return cipher.doFinal(data, IV_SIZE, data.size - IV_SIZE)
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

  private fun getOrCreateKey(): SecretKey {
    (keyStore().getKey(alias, null) as? SecretKey)?.let { return it }
    val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
      .apply { init(spec) }
      .generateKey()
  }

  private companion object {
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
    const val IV_SIZE = 12
    const val TAG_BITS = 128
  }
}

/** Lógica de la bóveda, sin Android: el cifrador y el almacén se inyectan. */
class TokenVaultCore(private val cipher: TokenCipher, private val store: KeyValueStore) {
  fun store(token: String) = synchronized(VaultLock) {
    // Token nuevo y marca fuera en una sola edición: nadie ve el token nuevo con la marca vieja.
    val encrypted = cipher.encrypt(token.toByteArray(Charsets.UTF_8)).toHex()
    store.write(mapOf(KEY_TOKEN to encrypted), setOf(KEY_INVALID))
  }

  /** null si no hay token o si no se puede leer ahora (ver `state`). Nunca lanza ni registra el token. */
  fun read(): String? = synchronized(VaultLock) { (readLocked() as? Read.Token)?.value }

  /**
   * Qué hay en la bóveda: ausente (nunca se guardó o se borró), ilegible (la clave ya no sirve o los datos están
   * corruptos: no tiene remedio) o transitorio (el Keystore falló de otra forma: el token puede seguir bien).
   * Registrar de nuevo crea una casa nueva y, por D-030, suelta a los seguidores: solo vale para los dos primeros.
   */
  fun state(): TokenState = synchronized(VaultLock) {
    when (readLocked()) {
      is Read.Token -> TokenState.PRESENT
      Read.Absent -> TokenState.ABSENT
      Read.Unreadable -> TokenState.UNREADABLE
      Read.Transient -> TokenState.TRANSIENT
    }
  }

  private sealed interface Read {
    data class Token(val value: String) : Read
    data object Absent : Read
    data object Unreadable : Read
    data object Transient : Read
  }

  private fun readLocked(): Read {
    val stored = store.get(KEY_TOKEN) ?: return Read.Absent
    val bytes = try {
      stored.fromHex()
    } catch (_: IllegalArgumentException) {
      return Read.Unreadable
    }
    return try {
      Read.Token(String(cipher.decrypt(bytes), Charsets.UTF_8))
    } catch (error: Exception) {
      if (classifyDecryptFailure(error) is PermanentKeyException) Read.Unreadable else Read.Transient
    }
  }

  fun clear() = synchronized(VaultLock) {
    store.write(emptyMap(), setOf(KEY_TOKEN, KEY_INVALID))
  }

  /**
   * El servidor rechazó `failedToken` (401). Solo se marca si ese sigue siendo el token guardado: si JS ya
   * registró uno nuevo, el rechazo del viejo no debe invalidarlo.
   */
  fun markInvalid(failedToken: String) = synchronized(VaultLock) {
    if ((readLocked() as? Read.Token)?.value == failedToken) store.put(KEY_INVALID, "1")
  }

  fun isInvalid(): Boolean = synchronized(VaultLock) { store.get(KEY_INVALID) == "1" }

  companion object {
    const val KEY_TOKEN = "device_token"
    const val KEY_INVALID = "device_token_invalid"
  }
}

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

private fun String.fromHex(): ByteArray {
  require(length % 2 == 0) { "hex inválido" }
  return ByteArray(length / 2) { i -> substring(2 * i, 2 * i + 2).toInt(16).toByte() }
}

/** Bóveda del token del dispositivo (regla 3): vive solo aquí, cifrada con el Android Keystore. */
object TokenVault {
  const val KEY_ALIAS = "pulso_token_key"
  const val PREFS = "pulso_vault"

  private fun core(context: Context) = TokenVaultCore(
    KeystoreCipher(),
    PrefsStore(context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)),
  )

  fun store(context: Context, token: String) = core(context).store(token)
  fun read(context: Context): String? = core(context).read()
  fun state(context: Context): TokenState = core(context).state()
  fun clear(context: Context) = core(context).clear()
  fun markInvalid(context: Context, failedToken: String) = core(context).markInvalid(failedToken)
  fun isInvalid(context: Context): Boolean = core(context).isInvalid()
}
