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

  /** Rechazados: el servidor respondió 400 o el JSON guardado no se puede leer. Nunca se reenvían. */
  fun markRejected(ids: Collection<String>)

  fun pendingCount(): Int
}

sealed interface UploadOutcome {
  /** Todo subido (o el latido vacío entregado). */
  data object Done : UploadOutcome

  /** No hay token, o el servidor ya lo rechazó: no se manda nada hasta que JS registre de nuevo. */
  data object NoToken : UploadOutcome

  /** 401: el token quedó marcado como inválido. No se reintenta. */
  data object TokenRejected : UploadOutcome

  /** 404: el dispositivo no vigila una casa. No se reintenta; el próximo latido o cambio vuelve a probar. */
  data object NoHome : UploadOutcome

  /** Sin red, timeout, 5xx o una excepción inesperada: reintento acotado por `UploadPolicy`. */
  data object Retry : UploadOutcome

  /** 429: volver a intentar después de `Retry-After`. */
  data class RetryAfter(val delayMs: Long) : UploadOutcome
}

/**
 * La lógica de la subida, sin Android. Manda lotes de hasta 200 mientras queden pendientes, y solo marca como
 * subido lo que el servidor aceptó con 2xx: un reintento manda los mismos ids y el backend deduplica (regla 4).
 * Un 400 marca el lote como rechazado y sigue con el siguiente, para que un evento inválido no trabe la cola.
 */
class Uploader(
  private val store: UploadStore,
  private val http: ApiHttp,
  private val apiUrl: String,
  private val token: String?,
  private val diagnostics: () -> JSONObject,
  private val clock: () -> Long,
  /** Recibe el JSON de `status` y la hora (epoch ms) en que llegó la respuesta. */
  private val onStatus: (String, Long) -> Unit,
  private val onTokenRejected: (String) -> Unit,
) {
  /** Nunca lanza: una excepción inesperada (por ejemplo, de SQLite) termina en `Retry`. */
  fun run(): UploadOutcome =
    try {
      upload()
    } catch (_: Exception) {
      UploadOutcome.Retry
    }

  private fun upload(): UploadOutcome {
    val token = token ?: return UploadOutcome.NoToken
    var requests = 0
    repeat(MAX_BATCHES_PER_RUN) {
      val pending = store.pending(BatchBuilder.MAX_EVENTS)
      val lastSent = store.lastUploadedSnapshotJson()?.let(SnapshotState::fromJson)
      val batch = BatchBuilder.build(pending, lastSent, diagnostics(), clock())
      store.markRejected(batch.rejectedIds)
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
            statusOf(response.body)?.let { onStatus(it, clock()) }
          }
          400 -> {
            // Lote inválido: sus eventos no se reenvían. Los saltados quedan pendientes, porque repetían un estado
            // que el servidor no recibió, y se vuelven a evaluar en el lote siguiente.
            if (batch.events.isEmpty()) return UploadOutcome.Retry
            store.markRejected(batch.events.map { it.id })
          }
          401 -> {
            onTokenRejected(token)
            return UploadOutcome.TokenRejected
          }
          404 -> return UploadOutcome.NoHome
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

/** Qué hace WorkManager con una corrida. Es independiente de Android para poder probar la política. */
sealed interface WorkDecision {
  data object Success : WorkDecision
  data object Retry : WorkDecision
  data object Failure : WorkDecision

  /** Encolar otra subida que espere `delayMs` y terminar esta con success. */
  data class RescheduleAfter(val delayMs: Long) : WorkDecision
}

/** Reintentos, retrasos y fallas de la subida. */
object UploadPolicy {
  /** Reintentos con backoff antes de rendirse: los latidos encolados detrás no pueden esperar horas. */
  const val MAX_RETRIES = 3
  const val BACKOFF_S = 30L

  /** El teléfono espera de 0 a 60 s al azar para que una zona entera no suba en el mismo segundo (api.md). */
  const val MAX_JITTER_MS = 60_000L

  fun initialDelayMs(baseMs: Long, random: Random = Random.Default): Long =
    baseMs + random.nextLong(0, MAX_JITTER_MS + 1)

  /**
   * `runAttemptCount` es el de WorkManager: 0 en la primera corrida. Al agotar los reintentos termina con success
   * sin marcar nada: los eventos siguen pendientes y la próxima subida la arranca el latido o un cambio.
   * 404 termina en failure, que también libera la cadena para la próxima encolada.
   */
  fun resultFor(outcome: UploadOutcome, runAttemptCount: Int): WorkDecision = when (outcome) {
    UploadOutcome.Done, UploadOutcome.NoToken, UploadOutcome.TokenRejected -> WorkDecision.Success
    UploadOutcome.NoHome -> WorkDecision.Failure
    UploadOutcome.Retry -> if (runAttemptCount >= MAX_RETRIES) WorkDecision.Success else WorkDecision.Retry
    is UploadOutcome.RetryAfter -> WorkDecision.RescheduleAfter(outcome.delayMs)
  }
}

/**
 * Sube los eventos a `POST /v1/events` (D-027). Lo encolan el latido (B) y cada snapshot que cambia el estado o
 * reporte manual. Es un cascarón: la lógica vive en `Uploader`.
 */
class UploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val context = applicationContext
    // Un teléfono que pasó a "follow" con una subida ya encolada: termina sin subir ni encadenar otra.
    if (Role.isFollowOnly(context)) return Result.success()
    val outcome = try {
      val config = ApiConfig.read(context) ?: return Result.success()
      val token = if (TokenVault.isInvalid(context)) null else TokenVault.read(context)
      Uploader(
        store = EventStore.get(context),
        http = UrlConnectionApiHttp(),
        apiUrl = config.apiUrl,
        token = token,
        diagnostics = { Diagnostics.contract(context) },
        clock = System::currentTimeMillis,
        onStatus = { status, receivedAt -> LastServerStatus.save(context, status, receivedAt) },
        onTokenRejected = { TokenVault.markInvalid(context, it) },
      ).run()
    } catch (e: Exception) {
      // Solo la clase: el mensaje podría traer datos de la petición.
      Log.w(SnapshotRecorder.TAG, "subida: error inesperado ${e.javaClass.simpleName}")
      UploadOutcome.Retry
    }
    val decision = UploadPolicy.resultFor(outcome, runAttemptCount)
    Log.i(SnapshotRecorder.TAG, "subida: $outcome intento=$runAttemptCount -> $decision")
    return when (decision) {
      WorkDecision.Success -> Result.success()
      WorkDecision.Retry -> Result.retry()
      WorkDecision.Failure -> Result.failure()
      is WorkDecision.RescheduleAfter -> {
        // Result.retry() no admite un retraso propio. REPLACE deja una sola subida esperando Retry-After en lugar
        // de la cadena: cada corrida sube todo lo pendiente, así que las encoladas detrás sobran.
        schedule(context, ExistingWorkPolicy.REPLACE, decision.delayMs)
        Result.success()
      }
    }
  }

  companion object {
    const val UNIQUE_NAME = "upload"

    /** Encola una subida detrás de la que esté en curso, con red requerida y 0 a 60 s de espera al azar. */
    fun enqueue(context: Context) = schedule(context, ExistingWorkPolicy.APPEND_OR_REPLACE, 0L)

    private fun schedule(context: Context, policy: ExistingWorkPolicy, delayMs: Long) {
      // Un teléfono que solo sigue una casa no sube nada, ni siquiera la continuación de una cadena vieja.
      if (Role.isFollowOnly(context)) return
      val request = OneTimeWorkRequestBuilder<UploadWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, UploadPolicy.BACKOFF_S, TimeUnit.SECONDS)
        .setInitialDelay(UploadPolicy.initialDelayMs(delayMs), TimeUnit.MILLISECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, policy, request)
    }
  }
}
