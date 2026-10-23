package expo.modules.powermonitor

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.random.Random

/** Lo que la subida necesita del almacén de eventos. `EventStore` lo implementa; los tests usan uno en memoria. */
interface UploadStore {
  /** Hasta `limit` eventos no subidos, en orden de `at` y luego de `id`. */
  fun pending(limit: Int): List<Event>

  /** El JSON del snapshot subido más reciente: su estado es el que el servidor ya conoce. */
  fun lastUploadedSnapshotJson(): String?

  fun markUploaded(ids: Collection<String>)

  fun pendingCount(): Int
}

sealed interface UploadOutcome {
  /** Todo subido (o el latido vacío entregado). */
  data object Done : UploadOutcome

  /** No hay token, o el servidor ya lo rechazó: no se manda nada hasta que JS registre de nuevo. */
  data object NoToken : UploadOutcome

  /** 401: el token quedó marcado como inválido. No se reintenta. */
  data object TokenRejected : UploadOutcome

  /** Sin red, timeout u otro error: que WorkManager reintente con su backoff. */
  data object Retry : UploadOutcome

  /** 429: volver a intentar después de `Retry-After`. */
  data class RetryAfter(val delayMs: Long) : UploadOutcome
}

/**
 * La lógica de la subida, sin Android. Manda lotes de hasta 200 mientras queden pendientes, y solo marca como
 * subido lo que el servidor aceptó con 2xx: un reintento manda los mismos ids y el backend deduplica (regla 4).
 */
class Uploader(
  private val store: UploadStore,
  private val http: ApiHttp,
  private val apiUrl: String,
  private val token: String?,
  private val diagnostics: () -> JSONObject,
  private val clock: () -> Long,
  private val onStatus: (String) -> Unit,
  private val onTokenRejected: (String) -> Unit,
) {
  fun run(): UploadOutcome {
    val token = token ?: return UploadOutcome.NoToken
    var requests = 0
    repeat(MAX_BATCHES_PER_RUN) {
      val pending = store.pending(BatchBuilder.MAX_EVENTS)
      val lastSent = store.lastUploadedSnapshotJson()?.let(SnapshotState::fromJson)
      val batch = BatchBuilder.build(pending, lastSent, diagnostics(), clock())
      if (batch.events.isEmpty() && requests > 0) {
        // Solo quedaban snapshots repetidos, y el latido ya viajó en esta corrida.
        store.markUploaded(batch.skippedIds)
      } else {
        val response = try {
          http.postJson("$apiUrl/v1/events", token, batch.json)
        } catch (_: IOException) {
          return UploadOutcome.Retry
        }
        requests += 1
        when (response.code) {
          in 200..299 -> {
            store.markUploaded(batch.events.map { it.id } + batch.skippedIds)
            statusOf(response.body)?.let(onStatus)
          }
          401 -> {
            onTokenRejected(token)
            return UploadOutcome.TokenRejected
          }
          429 -> {
            val seconds = (response.retryAfterSeconds ?: DEFAULT_RETRY_AFTER_S).coerceIn(1, MAX_RETRY_AFTER_S)
            return UploadOutcome.RetryAfter(seconds * 1_000)
          }
          else -> return UploadOutcome.Retry
        }
      }
      if (store.pendingCount() == 0) return UploadOutcome.Done
    }
    // Tope de seguridad: lo que quede sale en la próxima corrida.
    return UploadOutcome.Retry
  }

  private fun statusOf(body: String?): String? =
    body?.let { runCatching { JSONObject(it).getJSONObject("status").toString() }.getOrNull() }

  companion object {
    const val MAX_BATCHES_PER_RUN = 50
    const val DEFAULT_RETRY_AFTER_S = 60L
    const val MAX_RETRY_AFTER_S = 3_600L
  }
}

/**
 * Sube los eventos a `POST /v1/events` (D-027). Lo encolan el latido (B) y cada snapshot que cambia el estado o
 * reporte manual. Es un cascarón: la lógica vive en `Uploader`.
 */
class UploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val context = applicationContext
    val config = ApiConfig.read(context) ?: return Result.success()
    val token = if (TokenVault.isInvalid(context)) null else TokenVault.read(context)
    val outcome = Uploader(
      store = EventStore.get(context),
      http = UrlConnectionApiHttp(),
      apiUrl = config.apiUrl,
      token = token,
      diagnostics = { Diagnostics.contract(context) },
      clock = System::currentTimeMillis,
      onStatus = { LastServerStatus.save(context, it) },
      onTokenRejected = { TokenVault.markInvalid(context, it) },
    ).run()
    Log.i(SnapshotRecorder.TAG, "subida: $outcome")
    return when (outcome) {
      UploadOutcome.Done, UploadOutcome.NoToken, UploadOutcome.TokenRejected -> Result.success()
      UploadOutcome.Retry -> Result.retry()
      is UploadOutcome.RetryAfter -> {
        // Result.retry() no admite un retraso propio. REPLACE deja una sola subida esperando Retry-After en lugar
        // de la cadena: cada corrida sube todo lo pendiente, así que las encoladas detrás sobran.
        schedule(context, ExistingWorkPolicy.REPLACE, outcome.delayMs)
        Result.success()
      }
    }
  }

  companion object {
    const val UNIQUE_NAME = "upload"
    private const val BACKOFF_S = 30L
    private const val MAX_JITTER_MS = 10_000L

    /** Encola una subida detrás de la que esté en curso, con red requerida y 0 a 10 s de espera al azar. */
    fun enqueue(context: Context) = schedule(context, ExistingWorkPolicy.APPEND_OR_REPLACE, 0L)

    private fun schedule(context: Context, policy: ExistingWorkPolicy, delayMs: Long) {
      val request = OneTimeWorkRequestBuilder<UploadWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, BACKOFF_S, TimeUnit.SECONDS)
        .setInitialDelay(delayMs + Random.nextLong(0, MAX_JITTER_MS + 1), TimeUnit.MILLISECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, policy, request)
    }
  }
}
