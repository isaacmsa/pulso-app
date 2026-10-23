package expo.modules.powermonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import kotlin.concurrent.thread

/**
 * Mecanismo D (experimental): servicio en primer plano `specialUse` con un receiver dinámico de
 * ACTION_POWER_CONNECTED/DISCONNECTED, que Android 8+ ya no entrega a receivers del manifiesto.
 */
class PowerWatchService : Service() {
  private val powerReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      thread { SnapshotRecorder.record(applicationContext, "power_receiver") }
    }
  }

  private var registered = false

  override fun onCreate() {
    super.onCreate()
    // Un teléfono "follow" no vigila: si el sistema lo revive (START_STICKY de antes del desarme), se detiene solo.
    // `start()` ya no lo arranca en follow, así que aquí no hay un startForegroundService pendiente de atender.
    if (!shouldRun(Role.isFollowOnly(this))) {
      stopSelf()
      return
    }
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Vigilancia de la luz", NotificationManager.IMPORTANCE_LOW),
    )
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_charging)
      .setContentTitle("Pulso está vigilando la luz")
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_POWER_CONNECTED)
      addAction(Intent.ACTION_POWER_DISCONNECTED)
    }
    if (Build.VERSION.SDK_INT >= 33) {
      registerReceiver(powerReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(powerReceiver, filter)
    }
    registered = true
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val followOnly = Role.isFollowOnly(this)
    if (!shouldRun(followOnly)) stopSelf()
    return startMode(followOnly)
  }

  override fun onDestroy() {
    if (registered) unregisterReceiver(powerReceiver)
    running = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val CHANNEL_ID = "watch"
    private const val NOTIFICATION_ID = 1001
    const val PREF_ENABLED = "fgs.enabled"

    /** Un teléfono "follow" no corre D. */
    fun shouldRun(followOnly: Boolean): Boolean = !followOnly

    /** En follow, el sistema no lo revive si el proceso muere a mitad del desarme. */
    fun startMode(followOnly: Boolean): Int = if (followOnly) START_NOT_STICKY else START_STICKY

    fun start(context: Context) {
      if (!shouldRun(Role.isFollowOnly(context))) return
      runCatching { context.startForegroundService(Intent(context, PowerWatchService::class.java)) }
        .onFailure { Log.w(SnapshotRecorder.TAG, "no se pudo iniciar el servicio en primer plano", it) }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, PowerWatchService::class.java))
    }

    /** En memoria del proceso: si MIUI mata el proceso sin onDestroy, vuelve a false con él. */
    @Volatile var running = false
      private set
  }
}
