package expo.modules.powermonitor

import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import org.json.JSONObject

/**
 * Diagnóstico con la forma de `nativeDiagnosticsSchema` (pulso-api/src/domain/spike/schema.ts).
 * `armed` es el estado real de cada mecanismo en este momento, no lo que se pidió al armar.
 */
object Diagnostics {
  /**
   * Solo los campos de `diagnosticsSchema` (pulso-api/docs/api.md), los que viajan en cada lote.
   * `pendingEvents` son los eventos que todavía no se subieron.
   */
  fun contract(context: Context): JSONObject {
    val store = EventStore.get(context)
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
  }

  /** El diagnóstico completo de la pantalla de registro y del exporte: el del lote más el estado del registrador. */
  fun json(context: Context): JSONObject {
    val store = EventStore.get(context)
    val prefs = context.getSharedPreferences(Arming.PREFS, Context.MODE_PRIVATE)
    return contract(context)
      .put("storedEvents", store.count())
      .put("rejectedEvents", store.rejectedCount())
      .put("homeNetworkLearned", HomeNetwork(context).isLearned())
      .put(
        "armed",
        JSONObject()
          .put("networkCallback", prefs.getBoolean("armed.networkCallback", false))
          .put("heartbeat", Arming.isHeartbeatArmed(context))
          .put("chargingJob", ChargingJob.isArmed(context))
          .put("foregroundService", PowerWatchService.running),
      )
  }
}
