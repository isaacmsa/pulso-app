package expo.modules.powermonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

/** Al reiniciar el teléfono o actualizar la app: re-arma todo y toma un snapshot. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    val pending = goAsync()
    thread {
      try {
        val app = context.applicationContext
        Arming.ensureArmed(app)
        SnapshotRecorder.record(app, "boot")
      } finally {
        pending.finish()
      }
    }
  }
}
