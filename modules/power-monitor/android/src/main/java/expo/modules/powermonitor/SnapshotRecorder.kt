package expo.modules.powermonitor

import android.content.Context
import android.util.Log

/** Lee un snapshot, lo guarda y lo registra en logcat (tag PowerMonitor). */
object SnapshotRecorder {
  const val TAG = "PowerMonitor"

  fun record(context: Context, source: String): Snapshot {
    val snapshot = SnapshotReader.read(context, source)
    EventStore.get(context).insert(snapshot.id, snapshot.at, "snapshot", EventJson.snapshot(snapshot))
    Log.i(TAG, "snapshot $source plugged=${snapshot.plugged} wifi=${snapshot.onWifi} internet=${snapshot.internet}")
    return snapshot
  }
}
