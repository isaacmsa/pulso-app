package expo.modules.powermonitor

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Segunda lectura 90 s después de que el teléfono dejó de cargar. */
class TransitionCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    SnapshotRecorder.record(applicationContext, "transition_check")
    return Result.success()
  }
}
