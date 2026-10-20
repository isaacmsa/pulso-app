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
 * servicio en primer plano. Corre como máximo ~10 min, así que termina a los 9 y se vuelve a agendar.
 */
class ChargingJobService : JobService() {
  private val handler = Handler(Looper.getMainLooper())

  override fun onStartJob(params: JobParameters): Boolean {
    thread { SnapshotRecorder.record(applicationContext, "charging_job") }
    handler.postDelayed({
      jobFinished(params, false)
      ChargingJob.schedule(applicationContext)
    }, RUN_WINDOW_MS)
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    handler.removeCallbacksAndMessages(null)
    val reason = if (Build.VERSION.SDK_INT >= 31) params.stopReason else -1
    Log.i(SnapshotRecorder.TAG, "charging_job detenido, motivo=$reason")
    thread { SnapshotRecorder.record(applicationContext, "charging_job") }
    return true
  }

  private companion object {
    const val RUN_WINDOW_MS = 9 * 60_000L
  }
}

object ChargingJob {
  const val JOB_ID = 7001

  /** Agenda el trabajo si no está pendiente ni corriendo. Requiere RECEIVE_BOOT_COMPLETED por setPersisted. */
  fun schedule(context: Context) {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    if (scheduler.getPendingJob(JOB_ID) != null) return
    val job = JobInfo.Builder(JOB_ID, ComponentName(context, ChargingJobService::class.java))
      .setRequiresCharging(true)
      .setPersisted(true)
      .build()
    scheduler.schedule(job)
  }
}
