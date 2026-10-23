package expo.modules.powermonitor

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlin.concurrent.thread

/**
 * Mecanismo C: un trabajo que solo corre mientras el teléfono carga. Al desenchufar, el sistema lo
 * detiene (STOP_REASON_CONSTRAINT_CHARGING en API 31+) y eso graba un snapshot en segundos, sin
 * servicio en primer plano. Corre como máximo ~10 min: a los 9 agenda el otro id y termina.
 */
class ChargingJobService : JobService() {
  private val handler = Handler(Looper.getMainLooper())

  override fun onStartJob(params: JobParameters): Boolean {
    // Un teléfono que ya solo sigue una casa: no graba y no queda corriendo (false = trabajo terminado, sin relevo).
    if (!ChargingJob.shouldRecord(Role.isFollowOnly(applicationContext))) return false
    thread { SnapshotRecorder.record(applicationContext, "charging_job") }
    handler.postDelayed({
      if (!ChargingJob.shouldHandOver(Role.isFollowOnly(applicationContext))) {
        jobFinished(params, false)
        return@postDelayed
      }
      // Primero el relevo y después terminar: jobFinished es asíncrono y, con el mismo id,
      // el trabajo viejo todavía figuraría como pendiente y el nuevo no se crearía.
      ChargingJob.schedule(applicationContext, ChargingJob.nextId(params.jobId))
      jobFinished(params, false)
    }, RUN_WINDOW_MS)
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    handler.removeCallbacksAndMessages(null)
    // cancel() de un trabajo en curso llega aquí más tarde: en follow no se graba ni se reagenda el otro id.
    if (!ChargingJob.shouldRecord(Role.isFollowOnly(applicationContext))) return ChargingJob.RETRY_ON_STOP
    val reason = if (Build.VERSION.SDK_INT >= 31) params.stopReason else -1
    Log.i(SnapshotRecorder.TAG, "charging_job ${params.jobId} detenido, motivo=$reason")
    thread { SnapshotRecorder.record(applicationContext, "charging_job") }
    // Un trabajo nuevo con el otro id nace sin fallos acumulados: arranca en cuanto vuelve la carga.
    if (ChargingJob.shouldRescheduleOnStop(Role.isFollowOnly(applicationContext))) {
      ChargingJob.schedule(applicationContext, ChargingJob.nextId(params.jobId))
    }
    return ChargingJob.RETRY_ON_STOP
  }

  private companion object {
    const val RUN_WINDOW_MS = 9 * 60_000L
  }
}

object ChargingJob {
  // Ids altos para no chocar con los que WorkManager reparte desde 0 en el mismo JobScheduler.
  const val PRIMARY_ID = 0x50554C01
  const val SECONDARY_ID = 0x50554C02

  /** Nunca usar el reintento del sistema: su backoff exponencial crece con cada corte. */
  const val RETRY_ON_STOP = false

  /** Un teléfono "follow" no detecta: C no graba, no hace relevo y no se reagenda al detenerse. */
  fun shouldRecord(followOnly: Boolean): Boolean = !followOnly
  fun shouldHandOver(followOnly: Boolean): Boolean = !followOnly
  fun shouldRescheduleOnStop(followOnly: Boolean): Boolean = !followOnly

  fun nextId(current: Int): Int = if (current == PRIMARY_ID) SECONDARY_ID else PRIMARY_ID

  /** Si no hay ningún trabajo C pendiente ni corriendo, agenda el primario. */
  fun ensureScheduled(context: Context) {
    if (Role.isFollowOnly(context)) return
    if (!isArmed(context)) schedule(context, PRIMARY_ID)
  }

  fun isArmed(context: Context): Boolean {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    return scheduler.getPendingJob(PRIMARY_ID) != null || scheduler.getPendingJob(SECONDARY_ID) != null
  }

  /** Requiere RECEIVE_BOOT_COMPLETED por setPersisted. */
  fun schedule(context: Context, id: Int) {
    val job = JobInfo.Builder(id, ComponentName(context, ChargingJobService::class.java))
      .setRequiresCharging(true)
      .setPersisted(true)
      .build()
    context.getSystemService(JobScheduler::class.java).schedule(job)
  }
}
