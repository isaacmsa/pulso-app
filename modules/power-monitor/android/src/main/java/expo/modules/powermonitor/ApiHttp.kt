package expo.modules.powermonitor

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/** `retryAfterSeconds` sale de la cabecera `Retry-After` (solo en segundos). */
data class HttpResponse(val code: Int, val body: String?, val retryAfterSeconds: Long?)

/** El mínimo de HTTP que necesita la subida. Lanza `IOException` si no hay red o se vence el tiempo. */
interface ApiHttp {
  fun postJson(url: String, token: String, body: String): HttpResponse
}

/** `HttpURLConnection` con timeout de 15 s (D-024), sin dependencias nuevas (D-027). Nunca registra el token. */
class UrlConnectionApiHttp(private val timeoutMs: Int = 15_000) : ApiHttp {
  override fun postJson(url: String, token: String, body: String): HttpResponse {
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"
      connection.connectTimeout = timeoutMs
      connection.readTimeout = timeoutMs
      connection.doOutput = true
      connection.useCaches = false
      connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
      connection.setRequestProperty("Accept", "application/json")
      connection.setRequestProperty("Authorization", "Bearer $token")
      val bytes = body.toByteArray(Charsets.UTF_8)
      connection.setFixedLengthStreamingMode(bytes.size)
      connection.outputStream.use { it.write(bytes) }
      val code = connection.responseCode
      val stream = if (code in 200..299) connection.inputStream else connection.errorStream
      val text = try {
        stream?.use { readCapped(it) }
      } catch (_: IOException) {
        null
      }
      return HttpResponse(code, text, parseRetryAfter(connection.getHeaderField("Retry-After")))
    } finally {
      connection.disconnect()
    }
  }

  companion object {
    /** La respuesta de `/v1/events` ocupa unos cientos de bytes; más que esto no se lee. */
    const val MAX_BODY_BYTES = 64 * 1024

    /** Lee hasta `max` bytes como UTF-8. Un cuerpo más grande devuelve null: cortado no se podría leer como JSON. */
    fun readCapped(stream: InputStream, max: Int = MAX_BODY_BYTES): String? {
      val out = ByteArrayOutputStream()
      val buffer = ByteArray(8 * 1024)
      while (true) {
        val n = stream.read(buffer)
        if (n < 0) break
        if (out.size() + n > max) return null
        out.write(buffer, 0, n)
      }
      return out.toString(Charsets.UTF_8.name())
    }

    /** Solo la forma en segundos, que es la que usa pulso-api. Una fecha HTTP se ignora. */
    fun parseRetryAfter(value: String?): Long? = value?.trim()?.toLongOrNull()?.takeIf { it >= 0 }
  }
}
