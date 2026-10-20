package expo.modules.powermonitor

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.net.Inet4Address
import java.security.MessageDigest

/**
 * Reconoce la red de casa sin permiso de ubicación: huella SHA-256 de gateway IPv4 + subred.
 * La huella nunca sale del teléfono; solo viaja `homeWifi` como booleano.
 */
class HomeNetwork(context: Context) {
  private val appContext = context.applicationContext
  private val prefs = appContext.getSharedPreferences(Arming.PREFS, Context.MODE_PRIVATE)

  fun isLearned(): Boolean = prefs.contains(KEY)

  /** Guarda la huella de la red Wi-Fi actual. Devuelve false si no hay Wi-Fi con gateway IPv4. */
  fun learnCurrent(): Boolean {
    val fingerprint = currentFingerprint(appContext) ?: return false
    prefs.edit().putString(KEY, fingerprint).apply()
    return true
  }

  /** null si no hay huella aprendida; false si la hay pero no hay Wi-Fi o no coincide. */
  fun matches(fingerprint: String?): Boolean? {
    val learned = prefs.getString(KEY, null) ?: return null
    return fingerprint != null && fingerprint == learned
  }

  companion object {
    private const val KEY = "home.fingerprint"

    fun fingerprint(gatewayIpv4: String?, ipv4Network: String?): String? {
      if (gatewayIpv4 == null) return null
      val digest = MessageDigest.getInstance("SHA-256").digest("$gatewayIpv4|${ipv4Network.orEmpty()}".toByteArray())
      return digest.joinToString("") { "%02x".format(it) }
    }

    fun ipv4Network(address: ByteArray, prefixLength: Int): String {
      val bits = address.fold(0L) { acc, b -> (acc shl 8) or (b.toLong() and 0xFF) }
      val mask = if (prefixLength == 0) 0L else (0xFFFFFFFFL shl (32 - prefixLength)) and 0xFFFFFFFFL
      val network = bits and mask
      val octets = (3 downTo 0).map { (network ushr (8 * it)) and 0xFF }
      return octets.joinToString(".") + "/$prefixLength"
    }

    fun currentFingerprint(context: Context): String? {
      val cm = context.getSystemService(ConnectivityManager::class.java)
      @Suppress("DEPRECATION")
      val wifi = cm.allNetworks.firstOrNull { network ->
        cm.getNetworkCapabilities(network)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
      } ?: return null
      val link = cm.getLinkProperties(wifi) ?: return null
      val gateway = link.routes.firstOrNull { it.isDefaultRoute && it.gateway is Inet4Address }?.gateway?.hostAddress
      val subnet = link.linkAddresses.firstOrNull { it.address is Inet4Address }
        ?.let { ipv4Network(it.address.address, it.prefixLength) }
      return fingerprint(gateway, subnet)
    }
  }
}
