package expo.modules.powermonitor

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PowerMonitorModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PowerMonitor")

    // Devuelve el snapshot como JSON, con la misma forma que se subirá a la API.
    AsyncFunction("recordSnapshot") { source: String ->
      EventJson.snapshot(SnapshotRecorder.record(context, source))
    }

    AsyncFunction("getEvents") { sinceMs: Double ->
      "[" + EventStore.get(context).since(sinceMs.toLong()).joinToString(",") + "]"
    }
  }
}
