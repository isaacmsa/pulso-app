package expo.modules.powermonitor

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Deja armados los mecanismos de detección. Es idempotente: se llama al abrir la app y al arrancar el teléfono. */
object Arming {
  const val PREFS = "power_monitor"

  fun ensureArmed(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()

    // El mecanismo A se arma desde SnapshotRecorder cada vez que un snapshot ve el teléfono sin Wi-Fi.

    val heartbeat = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES).build()
    WorkManager.getInstance(context)
      .enqueueUniquePeriodicWork("heartbeat", ExistingPeriodicWorkPolicy.KEEP, heartbeat)
    prefs.putBoolean("armed.heartbeat", true)

    prefs.apply()
  }
}
