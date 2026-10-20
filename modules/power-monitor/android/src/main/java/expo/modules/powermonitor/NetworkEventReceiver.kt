package expo.modules.powermonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

/** Mecanismo A: lo despierta el `PendingIntent` de `NetworkWatch` cuando vuelve el Wi-Fi, aunque la app esté cerrada. */
class NetworkEventReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    thread {
      try {
        NetworkWatch.onFired(context.applicationContext)
        SnapshotRecorder.record(context.applicationContext, "network_callback")
      } finally {
        pending.finish()
      }
    }
  }
}
