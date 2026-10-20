package expo.modules.powermonitor

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.PowerManager

/** Lee el estado del teléfono en el momento en que algo despierta al módulo. Ver docs/detection.md. */
object SnapshotReader {
  fun read(context: Context, source: String): Snapshot {
    val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val plugged = (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val batteryPct = if (level >= 0 && scale > 0) (level * 100 / scale).coerceIn(0, 100) else null

    // Se recorren todas las redes: si el router no tiene internet, Android pasa la red por
    // defecto a datos móviles, pero el Wi-Fi sigue conectado.
    val cm = context.getSystemService(ConnectivityManager::class.java)
    var onWifi = false
    var internet: Boolean? = null
    @Suppress("DEPRECATION")
    for (network in cm.allNetworks) {
      val caps = cm.getNetworkCapabilities(network) ?: continue
      if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
        onWifi = true
        internet = internet == true || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
      }
    }

    val interactive = runCatching { context.getSystemService(PowerManager::class.java).isInteractive }.getOrNull()
    val now = System.currentTimeMillis()
    return Snapshot(
      id = UuidV7.generate(now),
      at = now,
      source = source,
      plugged = plugged,
      onWifi = onWifi,
      homeWifi = HomeNetwork(context).matches(if (onWifi) HomeNetwork.currentFingerprint(context) else null),
      internet = internet,
      interactive = interactive,
      batteryPct = batteryPct,
    )
  }
}
