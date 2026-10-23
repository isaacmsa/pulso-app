package expo.modules.powermonitor

import java.io.IOException
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
        stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
      } catch (_: IOException) {
        null
      }
      return HttpResponse(code, text, parseRetryAfter(connection.getHeaderField("Retry-After")))
    } finally {
      connection.disconnect()
    }
  }

  companion object {
    /** Solo la forma en segundos, que es la que usa pulso-api. Una fecha HTTP se ignora. */
    fun parseRetryAfter(value: String?): Long? = value?.trim()?.toLongOrNull()?.takeIf { it >= 0 }
  }
}
