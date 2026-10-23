package expo.modules.powermonitor

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val REPORT_VALUES = setOf("hay_luz", "fluctuando", "sin_luz")

class PowerMonitorModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PowerMonitor")

    // Devuelve el snapshot como JSON, con la misma forma que se subirá a la API.
    AsyncFunction("recordSnapshot") { source: String ->
      EventJson.snapshot(SnapshotRecorder.record(context, source))
    }

    AsyncFunction("arm") {
      Arming.ensureArmed(context)
    }

    AsyncFunction("setForegroundServiceEnabled") { enabled: Boolean ->
      Arming.setForegroundServiceEnabled(context, enabled)
    }

    AsyncFunction("recordReport") { value: String ->
      if (value !in REPORT_VALUES) throw IllegalArgumentException("reporte desconocido: $value")
      val now = System.currentTimeMillis()
      val report = Report(UuidV7.generate(now), now, value)
      val json = EventJson.report(report)
      EventStore.get(context).insert(report.id, report.at, "report", json)
      UploadWorker.enqueue(context)
      json
    }

    AsyncFunction("learnHomeNetwork") {
      HomeNetwork(context).learnCurrent()
    }

    AsyncFunction("getDiagnostics") {
      Diagnostics.json(context).toString()
    }

    AsyncFunction("exportEvents") {
      Exporter.export(context)
    }

    AsyncFunction("isForegroundServiceEnabled") {
      Arming.isForegroundServiceEnabled(context)
    }

    AsyncFunction("getEvents") { sinceMs: Double ->
      "[" + EventStore.get(context).since(sinceMs.toLong()).joinToString(",") + "]"
    }

    // Bóveda del token (regla 3): JS lo entrega al registrarse y lo pide en cada llamada; nunca lo guarda.
    AsyncFunction("storeToken") { token: String ->
      TokenVault.store(context, token)
    }

    AsyncFunction("getToken") {
      TokenVault.read(context)
    }

    AsyncFunction("isTokenInvalid") {
      TokenVault.isInvalid(context)
    }

    // El último HomeStatus que devolvió la subida, como JSON (o null). JS lo valida con zHomeStatus.
    AsyncFunction("getLastServerStatus") {
      LastServerStatus.read(context)
    }

    // La versión de la app sale del paquete instalado, la misma que reporta el diagnóstico.
    AsyncFunction("configureApi") { apiUrl: String ->
      val version = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
      }.getOrNull().orEmpty()
      ApiConfig.save(context, apiUrl, version)
    }
  }
}
