package expo.modules.powermonitor

import android.content.Context
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Escribe `{ exportedAt, diagnostics, events }` (spikeExportSchema de pulso-api) en el caché y devuelve su URI. */
object Exporter {
  fun export(context: Context): String {
    val now = System.currentTimeMillis()
    val events = JSONArray()
    EventStore.get(context).since(0, limit = Int.MAX_VALUE).asReversed().forEach { events.put(JSONObject(it)) }
    val payload = JSONObject()
      .put("exportedAt", now)
      .put("diagnostics", Diagnostics.json(context))
      .put("events", events)
    val dir = File(context.cacheDir, "exports").apply { mkdirs() }
    val stamp = SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date(now))
    val maker = Build.MANUFACTURER.lowercase(Locale.US).replace(Regex("[^a-z0-9]"), "")
    val file = File(dir, "pulso-$maker-$stamp.json")
    file.writeText(payload.toString())
    return Uri.fromFile(file).toString()
  }
}
