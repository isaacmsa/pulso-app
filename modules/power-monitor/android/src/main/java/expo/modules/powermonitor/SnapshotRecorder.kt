package expo.modules.powermonitor

import android.content.Context
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Lee un snapshot, lo guarda, lo registra en logcat (tag PowerMonitor) y, si cambió el estado, encola la subida. */
object SnapshotRecorder {
  const val TAG = "PowerMonitor"
  private const val TRANSITION_CHECK_DELAY_MS = 90_000L

  fun record(context: Context, source: String): Snapshot {
    val store = EventStore.get(context)
    val prev = store.lastSnapshotJson()?.let(SnapshotState::fromJson)
    val snapshot = SnapshotReader.read(context, source)
    store.insert(snapshot.id, snapshot.at, "snapshot", EventJson.snapshot(snapshot))
    Log.i(TAG, "snapshot $source plugged=${snapshot.plugged} wifi=${snapshot.onWifi} internet=${snapshot.internet}")
    if (shouldScheduleTransitionCheck(prev?.plugged, snapshot.plugged)) scheduleTransitionCheck(context)
    if (shouldEnqueueUpload(source, prev, SnapshotState.of(snapshot))) UploadWorker.enqueue(context)
    if (NetworkWatch.shouldArmForWifiReturn(snapshot.onWifi)) NetworkWatch.armForWifiReturn(context)
    return snapshot
  }

  /** Al dejar de cargar, otra lectura a los 90 s dice si el Wi-Fi también se cayó (corte) o siguió. */
  fun shouldScheduleTransitionCheck(prevPlugged: Boolean?, nowPlugged: Boolean): Boolean =
    prevPlugged == true && !nowPlugged

  /**
   * Solo un cambio de `(plugged, onWifi, homeWifi, internet)` adelanta la subida (regla 6). El latido encola la suya
   * en `HeartbeatWorker`, cambie o no el estado, porque viaja aunque el lote esté vacío.
   */
  fun shouldEnqueueUpload(source: String, prev: SnapshotState?, now: SnapshotState): Boolean =
    source != "heartbeat" && prev != now

  private fun scheduleTransitionCheck(context: Context) {
    val request = OneTimeWorkRequestBuilder<TransitionCheckWorker>()
      .setInitialDelay(TRANSITION_CHECK_DELAY_MS, TimeUnit.MILLISECONDS)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork("transition_check", ExistingWorkPolicy.REPLACE, request)
  }
}
