package expo.modules.powermonitor

import android.app.job.JobScheduler
import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Deja armados los mecanismos de detección. Es idempotente: se llama al abrir la app y al arrancar el teléfono. */
object Arming {
  const val PREFS = "power_monitor"
  private const val HEARTBEAT = "heartbeat"
  private const val LEGACY_CHARGING_JOB_ID = 7001 // id de C hasta el 2026-10-20

  fun ensureArmed(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    // D primero: arrancar un servicio en primer plano solo se permite durante una ventana corta
    // después de BOOT_COMPLETED o MY_PACKAGE_REPLACED.
    if (prefs.getBoolean(PowerWatchService.PREF_ENABLED, false)) PowerWatchService.start(context)

    // El mecanismo A se arma desde SnapshotRecorder cada vez que un snapshot ve el teléfono sin Wi-Fi.

    val heartbeat = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES).build()
    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork(HEARTBEAT, ExistingPeriodicWorkPolicy.KEEP, heartbeat)

    cancelLegacyChargingJob(context)
    ChargingJob.ensureScheduled(context)
  }

  fun setForegroundServiceEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(PowerWatchService.PREF_ENABLED, enabled).apply()
    if (enabled) PowerWatchService.start(context) else PowerWatchService.stop(context)
  }

  fun isForegroundServiceEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PowerWatchService.PREF_ENABLED, false)

  fun isHeartbeatArmed(context: Context): Boolean =
    runCatching {
      WorkManager.getInstance(context).getWorkInfosForUniqueWork(HEARTBEAT).get()
        .any { it.state == WorkInfo.State.ENQUEUED || it.state == WorkInfo.State.RUNNING }
    }.getOrDefault(false)

  private fun cancelLegacyChargingJob(context: Context) {
    val scheduler = context.getSystemService(JobScheduler::class.java)
    val legacy = scheduler.getPendingJob(LEGACY_CHARGING_JOB_ID) ?: return
    if (legacy.service.className == ChargingJobService::class.java.name) scheduler.cancel(LEGACY_CHARGING_JOB_ID)
  }
}
