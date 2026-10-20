package expo.modules.powermonitor

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Mecanismo B: latido cada 15 minutos (el mínimo de WorkManager). */
class HeartbeatWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    SnapshotRecorder.record(applicationContext, "heartbeat")
    return Result.success()
  }
}
