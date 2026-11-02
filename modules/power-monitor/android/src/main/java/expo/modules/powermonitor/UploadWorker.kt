package expo.modules.powermonitor

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Looper
import android.util.Log
import androidx.annotation.WorkerThread
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
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

  /** Rechazados: el servidor respondió 400 o 413, o el JSON guardado no se puede leer. Nunca se reenvían. */
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

  /** Sin red, timeout, 5xx, una excepción inesperada o una corrida detenida: reintento acotado por `UploadPolicy`. */
  data object Retry : UploadOutcome

  /** 429: volver a intentar después de `Retry-After`. */
  data class RetryAfter(val delayMs: Long) : UploadOutcome
}

/**
 * La lógica de la subida, sin Android. Manda lotes de hasta 200 mientras queden pendientes, y solo marca como
 * subido lo que el servidor aceptó con 2xx: un reintento manda los mismos ids y el backend deduplica (regla 4).
 * Un 400 o un 413 marca el lote como rechazado y sigue con el siguiente, para que un evento inválido no trabe la cola.
 * El latido viaja aunque todo lo pendiente se haya rechazado (regla 6).
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
  /** `isStopped` del Worker: se consulta antes de cada lote. */
  private val shouldStop: () -> Boolean = { false },
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
    // Respuestas 2xx de esta corrida. Un lote rechazado no cuenta: el latido todavía no llegó.
    var delivered = 0
    repeat(MAX_BATCHES_PER_RUN) {
      // WorkManager reprograma una corrida detenida; lo no marcado sale en la próxima.
      if (shouldStop()) return UploadOutcome.Retry
      val pending = store.pending(BatchBuilder.MAX_EVENTS)
      val lastSent = store.lastUploadedSnapshotJson()?.let(SnapshotState::fromJson)
      val batch = BatchBuilder.build(pending, lastSent, diagnostics(), clock())
      store.markRejected(batch.rejectedIds)
      if (batch.events.isEmpty() && delivered > 0) {
        // Solo quedaban snapshots repetidos, y el latido ya viajó en esta corrida.
        store.markUploaded(batch.skippedIds)
      } else {
        val response = try {
          http.postJson("$apiUrl/v1/events", token, batch.json)
        } catch (_: IOException) {
          return UploadOutcome.Retry
        }
        when (response.code) {
          in 200..299 -> {
            delivered += 1
            store.markUploaded(batch.events.map { it.id } + batch.skippedIds)
            statusOf(response.body)?.let { onStatus(it, clock()) }
          }
          400, 413 -> {
            // Lote inválido o demasiado grande: sus eventos no se reenvían. Los saltados quedan pendientes, porque
            // repetían un estado que el servidor no recibió, y se vuelven a evaluar en el lote siguiente. Si no queda
            // nada, la vuelta siguiente manda el latido vacío.
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
      if (delivered > 0 && store.pendingCount() == 0) return UploadOutcome.Done
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

/** Qué dejó una llamada a encolar. */
enum class EnqueueResult {
  Enqueued,

  /** Ya había una subida ENQUEUED o BLOCKED: esa sube todo lo pendiente. */
  AlreadyPending,

  /** Teléfono que solo sigue casas: no sube nada. */
  FollowOnly,

  /** WorkManager lanzó al encolar: la subida no quedó escrita. */
  Failed,
}

/** Qué hacer si `enqueue` se llama en el hilo principal, donde sus lecturas bloqueantes congelarían la pantalla. */
enum class ThreadGuard { Ok, Throw, Wtf }

/** Qué hace una corrida al arrancar, ya con red. */
sealed interface StartDecision {
  data object Upload : StartDecision

  /** Reprogramarse una vez con este retraso y terminar sin subir. */
  data class WaitFirst(val delayMs: Long) : StartDecision
}

/** Reintentos, retrasos y fallas de la subida. */
object UploadPolicy {
  /** Reintentos con backoff antes de rendirse: los latidos encolados detrás no pueden esperar horas. */
  const val MAX_RETRIES = 3
  const val BACKOFF_S = 30L

  /** El teléfono espera de 0 a 60 s al azar para que una zona entera no suba en el mismo segundo (api.md). */
  const val MAX_JITTER_MS = 60_000L

  /**
   * Encolar no espera: un retraso inicial correría mientras no hay red y la subida saldría justo al volver, junto con
   * los demás teléfonos de la zona. La espera al azar la hace la primera corrida, que ya arranca con red.
   */
  const val ENQUEUE_DELAY_MS = 0L

  /**
   * Una corrida que arrancó más de esto después de lo previsto estuvo esperando la red: sale justo cuando vuelve, con
   * el resto de la zona, y por eso también espera al azar aunque la haya encolado el latido.
   */
  const val LATE_START_MS = 60_000L

  /** Tope para cada consulta bloqueante a WorkManager dentro de `enqueue`. */
  const val WORK_MANAGER_TIMEOUT_MS = 2_000L

  /**
   * Solo la vuelta del Wi-Fi (mecanismo A) y el arranque del teléfono esperan al azar: son los que llegan a la vez en
   * toda una zona cuando vuelve la luz. El latido, los cambios de estado, los reportes, las confirmaciones y
   * `requestUpload` suben ya.
   */
  fun jitterFor(source: String): Boolean = source == "network_callback" || source == "boot"

  /**
   * La primera corrida de una subida que pidió espera (`waited` falso, primer intento) se reprograma con 0 a 60 s al
   * azar. También la de una que arrancó más de `LATE_START_MS` tarde (`lateByMs`), porque quedó esperando la red. La
   * reprogramada sube. Un reintento con backoff tampoco espera de nuevo: el backoff ya lo separa.
   */
  fun startDecision(
    waited: Boolean,
    runAttemptCount: Int,
    lateByMs: Long = 0,
    random: Random = Random.Default,
  ): StartDecision =
    if (runAttemptCount > 0 || (waited && lateByMs <= LATE_START_MS)) {
      StartDecision.Upload
    } else {
      StartDecision.WaitFirst(random.nextLong(0, MAX_JITTER_MS + 1))
    }

  /** Si la reprogramada no quedó escrita, esta corrida reintenta: con success la subida se perdería. */
  fun afterWaitFirst(result: EnqueueResult): WorkDecision =
    if (result == EnqueueResult.Failed) WorkDecision.Retry else WorkDecision.Success

  /** Lee la cadena; null si falló o pasó el tope. Sin poder leerla, mejor una subida de más que ninguna. */
  fun chainStatesOrNull(read: () -> List<WorkInfo.State>): List<WorkInfo.State>? =
    try {
      read()
    } catch (_: Exception) {
      null
    }

  fun threadGuard(onMainThread: Boolean, debuggable: Boolean): ThreadGuard = when {
    !onMainThread -> ThreadGuard.Ok
    debuggable -> ThreadGuard.Throw
    else -> ThreadGuard.Wtf
  }

  /**
   * Con una subida ENQUEUED o BLOCKED en la cadena no se encola otra: esa ya sube todo lo pendiente cuando corra,
   * y sin red la cadena no crece con cada latido. Con una RUNNING sola se encadena una más, porque la que corre
   * pudo leer los pendientes antes del evento nuevo. Las terminadas no cuentan.
   */
  fun shouldEnqueue(states: List<WorkInfo.State>?): Boolean =
    states == null || states.none { it == WorkInfo.State.ENQUEUED || it == WorkInfo.State.BLOCKED }

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
    // Sin KEY_DUE_AT (una subida encolada por una versión anterior) no se considera atrasada.
    val dueAt = inputData.getLong(KEY_DUE_AT, Long.MAX_VALUE)
    val lateByMs = if (dueAt == Long.MAX_VALUE) 0L else System.currentTimeMillis() - dueAt
    val start = UploadPolicy.startDecision(inputData.getBoolean(KEY_WAITED, false), runAttemptCount, lateByMs)
    if (start is StartDecision.WaitFirst) {
      // Va detrás de esta corrida (RUNNING), así que su retraso cuenta desde ahora, con red.
      val result = enqueueIfNone(context, waited = true, delayMs = start.delayMs)
      Log.i(SnapshotRecorder.TAG, "subida: espera ${start.delayMs} ms antes de subir ($result)")
      return when (UploadPolicy.afterWaitFirst(result)) {
        WorkDecision.Retry -> Result.retry()
        else -> Result.success()
      }
    }
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
        shouldStop = { isStopped },
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
        // de la cadena: cada corrida sube todo lo pendiente, así que las encoladas detrás sobran. Ya esperó: no vuelve
        // a reprogramarse al arrancar.
        val delayMs = UploadPolicy.initialDelayMs(decision.delayMs)
        val result = synchronized(enqueueLock) {
          schedule(context, ExistingWorkPolicy.REPLACE, waited = true, delayMs = delayMs)
        }
        if (result == EnqueueResult.Failed) Result.retry() else Result.success()
      }
    }
  }

  companion object {
    const val UNIQUE_NAME = "upload"
    /** true: sube sin la espera al azar (salvo que arranque tarde). El nombre viene de la versión anterior. */
    private const val KEY_WAITED = "waited"

    /** Epoch ms en que la subida debía correr: encolada + retraso inicial. */
    private const val KEY_DUE_AT = "dueAt"
    private val enqueueLock = Any()

    /**
     * Pide una subida con red requerida. Si ya hay una esperando no hace nada; si una está corriendo, encadena una
     * detrás. Con `jitter` (solo la vuelta del Wi-Fi y el arranque, `UploadPolicy.jitterFor`), la primera corrida, ya
     * con red, espera de 0 a 60 s (`UploadPolicy.startDecision`). Bloquea hasta 2 s por consulta a WorkManager: nunca
     * en el hilo principal.
     */
    @WorkerThread
    fun enqueue(context: Context, jitter: Boolean): EnqueueResult {
      guardWorkerThread(context)
      return enqueueIfNone(context, waited = !jitter, delayMs = UploadPolicy.ENQUEUE_DELAY_MS)
    }

    private fun guardWorkerThread(context: Context) {
      val debuggable = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
      when (UploadPolicy.threadGuard(Looper.myLooper() == Looper.getMainLooper(), debuggable)) {
        ThreadGuard.Ok -> Unit
        ThreadGuard.Throw -> check(false) { "UploadWorker.enqueue en el hilo principal" }
        ThreadGuard.Wtf -> Log.wtf(SnapshotRecorder.TAG, "subida: enqueue en el hilo principal")
      }
    }

    /**
     * Mira la cadena y encola bajo un candado del proceso, para que dos llamadas a la vez no encadenen dos. Cada
     * consulta a la base de WorkManager espera como máximo `WORK_MANAGER_TIMEOUT_MS`: si leer la cadena se pasa, se
     * encola igual (una subida de más, nunca ninguna).
     */
    @WorkerThread
    private fun enqueueIfNone(context: Context, waited: Boolean, delayMs: Long): EnqueueResult {
      if (Role.isFollowOnly(context)) return EnqueueResult.FollowOnly
      synchronized(enqueueLock) {
        val states = UploadPolicy.chainStatesOrNull {
          WorkManager.getInstance(context).getWorkInfosForUniqueWork(UNIQUE_NAME)
            .get(UploadPolicy.WORK_MANAGER_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .map { it.state }
        }
        if (states == null) Log.w(SnapshotRecorder.TAG, "subida: no se leyó la cadena, se encola igual")
        if (!UploadPolicy.shouldEnqueue(states)) return EnqueueResult.AlreadyPending
        return schedule(context, ExistingWorkPolicy.APPEND_OR_REPLACE, waited, delayMs)
      }
    }

    @WorkerThread
    private fun schedule(context: Context, policy: ExistingWorkPolicy, waited: Boolean, delayMs: Long): EnqueueResult {
      // Un teléfono que solo sigue una casa no sube nada, ni siquiera la continuación de una cadena vieja.
      if (Role.isFollowOnly(context)) return EnqueueResult.FollowOnly
      val request = OneTimeWorkRequestBuilder<UploadWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, UploadPolicy.BACKOFF_S, TimeUnit.SECONDS)
        .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
        .setInputData(workDataOf(KEY_WAITED to waited, KEY_DUE_AT to System.currentTimeMillis() + delayMs))
        .build()
      val operation = try {
        WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE_NAME, policy, request)
      } catch (e: Exception) {
        Log.w(SnapshotRecorder.TAG, "subida: no se encoló ${e.javaClass.simpleName}")
        return EnqueueResult.Failed
      }
      // Esperar el resultado deja la cadena escrita antes de soltar el candado. Si pasa el tope, la operación ya quedó
      // en la cola de WorkManager y se escribe igual: no se pierde.
      return try {
        operation.result.get(UploadPolicy.WORK_MANAGER_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        EnqueueResult.Enqueued
      } catch (_: java.util.concurrent.TimeoutException) {
        Log.w(SnapshotRecorder.TAG, "subida: encolar pasó de 2 s, sigue en la cola de WorkManager")
        EnqueueResult.Enqueued
      } catch (e: Exception) {
        Log.w(SnapshotRecorder.TAG, "subida: no se encoló ${e.javaClass.simpleName}")
        EnqueueResult.Failed
      }
    }
  }
}
