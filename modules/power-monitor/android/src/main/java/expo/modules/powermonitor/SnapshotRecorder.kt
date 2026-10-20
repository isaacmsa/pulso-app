package expo.modules.powermonitor

import android.content.Context
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Lee un snapshot, lo guarda y lo registra en logcat (tag PowerMonitor). */
object SnapshotRecorder {
  const val TAG = "PowerMonitor"
  private const val TRANSITION_CHECK_DELAY_MS = 90_000L

  fun record(context: Context, source: String): Snapshot {
    val store = EventStore.get(context)
    val prevPlugged = store.lastSnapshotJson()?.let { runCatching { JSONObject(it).getBoolean("plugged") }.getOrNull() }
    val snapshot = SnapshotReader.read(context, source)
    store.insert(snapshot.id, snapshot.at, "snapshot", EventJson.snapshot(snapshot))
    Log.i(TAG, "snapshot $source plugged=${snapshot.plugged} wifi=${snapshot.onWifi} internet=${snapshot.internet}")
    if (shouldScheduleTransitionCheck(prevPlugged, snapshot.plugged)) scheduleTransitionCheck(context)
    if (NetworkWatch.shouldArmForWifiReturn(snapshot.onWifi)) NetworkWatch.armForWifiReturn(context)
    return snapshot
  }

  /** Al dejar de cargar, otra lectura a los 90 s dice si el Wi-Fi también se cayó (corte) o siguió. */
  fun shouldScheduleTransitionCheck(prevPlugged: Boolean?, nowPlugged: Boolean): Boolean =
    prevPlugged == true && !nowPlugged

  private fun scheduleTransitionCheck(context: Context) {
    val request = OneTimeWorkRequestBuilder<TransitionCheckWorker>()
      .setInitialDelay(TRANSITION_CHECK_DELAY_MS, TimeUnit.MILLISECONDS)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork("transition_check", ExistingWorkPolicy.REPLACE, request)
  }
}
