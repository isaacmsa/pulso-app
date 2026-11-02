package expo.modules.powermonitor

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Mecanismo B: latido cada 15 minutos (el mínimo de WorkManager). Siempre encola la subida: el latido viaja aunque el lote esté vacío. */
class HeartbeatWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    // Un latido que ya estaba programado cuando el teléfono pasó a "follow" no hace nada.
    if (Role.isFollowOnly(applicationContext)) return Result.success()
    SnapshotRecorder.record(applicationContext, "heartbeat")
    UploadWorker.enqueue(applicationContext, jitter = false)
    return Result.success()
  }
}
