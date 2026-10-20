package expo.modules.powermonitor

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest

/**
 * Mecanismo A: avisa cuando vuelve el Wi-Fi (el fin de un corte).
 *
 * `registerNetworkCallback(request, PendingIntent)` dispara una sola vez, cuando una red que cumple
 * el pedido queda disponible, y el sistema libera el pedido después de enviar el aviso. Nunca avisa
 * al perder la red. Por eso se arma solo cuando el teléfono no tiene Wi-Fi: si se arma con Wi-Fi,
 * dispara al instante y no sirve. Medido en un Redmi A5 (Android 15) el 2026-10-20.
 */
object NetworkWatch {
  const val ACTION_WIFI_RETURN = "expo.modules.powermonitor.WIFI_RETURN"

  fun shouldArmForWifiReturn(onWifi: Boolean): Boolean = !onWifi

  fun armForWifiReturn(context: Context) {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    val wifi = NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build()
    cm.registerNetworkCallback(wifi, pendingIntent(context))
    setArmed(context, true)
  }

  /** El sistema ya liberó el pedido al disparar: queda desarmado hasta el próximo snapshot sin Wi-Fi. */
  fun onFired(context: Context) = setArmed(context, false)

  private fun setArmed(context: Context, armed: Boolean) =
    context.getSharedPreferences(Arming.PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean("armed.networkCallback", armed).apply()

  // Mutable: el sistema le agrega la red y la petición como extras.
  private fun pendingIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      1,
      Intent(context, NetworkEventReceiver::class.java).setAction(ACTION_WIFI_RETURN),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
}
