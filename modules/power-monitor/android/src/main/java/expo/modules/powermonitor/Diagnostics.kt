package expo.modules.powermonitor

import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import org.json.JSONObject

/** Diagnóstico con la forma de `nativeDiagnosticsSchema` (pulso-api/src/domain/spike/schema.ts). */
object Diagnostics {
  fun json(context: Context): JSONObject {
    val store = EventStore.get(context)
    val prefs = context.getSharedPreferences(Arming.PREFS, Context.MODE_PRIVATE)
    val standbyBucket = if (Build.VERSION.SDK_INT >= 28) {
      context.getSystemService(UsageStatsManager::class.java).appStandbyBucket
    } else {
      null
    }
    val appVersion = runCatching {
      context.packageManager.getPackageInfo(context.packageName, 0).versionName
    }.getOrNull() ?: "desconocida"
    return JSONObject()
      .put("appVersion", appVersion)
      .put("manufacturer", Build.MANUFACTURER)
      .put("model", Build.MODEL)
      .put("sdkInt", Build.VERSION.SDK_INT)
      .put("standbyBucket", standbyBucket ?: JSONObject.NULL)
      .put(
        "ignoringBatteryOptimizations",
        context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName),
      )
      .put("pendingEvents", store.pendingCount())
      .put("storedEvents", store.count())
      .put("homeNetworkLearned", HomeNetwork(context).isLearned())
      .put(
        "armed",
        JSONObject()
          .put("networkCallback", prefs.getBoolean("armed.networkCallback", false))
          .put("heartbeat", prefs.getBoolean("armed.heartbeat", false))
          .put("chargingJob", prefs.getBoolean("armed.chargingJob", false))
          .put("foregroundService", prefs.getBoolean("armed.foregroundService", false)),
      )
  }
}
