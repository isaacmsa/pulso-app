package expo.modules.powermonitor

import java.security.SecureRandom
import java.util.Random

/** UUID v7 (RFC 9562): 48 bits de epoch ms, versión 7, variante RFC y 74 bits aleatorios. */
object UuidV7 {
  private val secureRandom = SecureRandom()

  fun generate(nowMs: Long = System.currentTimeMillis(), random: Random = secureRandom): String {
    val bytes = ByteArray(16)
    random.nextBytes(bytes)
    for (i in 0 until 6) {
      bytes[i] = (nowMs ushr (8 * (5 - i))).toByte()
    }
    bytes[6] = ((bytes[6].toInt() and 0x0F) or 0x70).toByte()
    bytes[8] = ((bytes[8].toInt() and 0x3F) or 0x80).toByte()
    val hex = bytes.joinToString("") { "%02x".format(it) }
    return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-" +
      "${hex.substring(16, 20)}-${hex.substring(20)}"
  }
}
