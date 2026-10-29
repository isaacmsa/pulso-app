package expo.modules.powermonitor

import android.content.ContentValues
import android.content.Context
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Eventos guardados en el teléfono (14 días). Es la fuente del estado crudo y de la subida.
 * La columna `uploaded` existe desde la versión 1 del esquema (fase 0), así que no hace falta migrar:
 * vale 0 (pendiente), 1 (subido o saltado) o 2 (rechazado).
 */
class EventStore private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "power_monitor.db", null, 1), UploadStore {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      "CREATE TABLE events (id TEXT PRIMARY KEY, at INTEGER NOT NULL, kind TEXT NOT NULL, " +
        "json TEXT NOT NULL, uploaded INTEGER NOT NULL DEFAULT 0)",
    )
    db.execSQL("CREATE INDEX events_at ON events (at)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  @Synchronized
  fun insert(id: String, at: Long, kind: String, json: String) {
    val db = writableDatabase
    val values = ContentValues().apply {
      put("id", id)
      put("at", at)
      put("kind", kind)
      put("json", json)
    }
    db.insertWithOnConflict("events", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    db.delete("events", "at < ?", arrayOf((System.currentTimeMillis() - RETENTION_MS).toString()))
  }

  /** Vacía el almacén, también lo pendiente de subir (solo lo hace el borrado de datos). */
  @Synchronized
  fun clear() {
    writableDatabase.delete("events", null, null)
  }

  /** Los eventos desde `sinceMs`, del más nuevo al más viejo, como JSON. */
  fun since(sinceMs: Long, limit: Int = 500): List<String> =
    readableDatabase.rawQuery(
      "SELECT json FROM events WHERE at >= ? ORDER BY at DESC, id DESC LIMIT ?",
      arrayOf(sinceMs.toString(), limit.toString()),
    ).use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }

  fun count(): Int = DatabaseUtils.queryNumEntries(readableDatabase, "events").toInt()

  override fun pendingCount(): Int = DatabaseUtils.queryNumEntries(readableDatabase, "events", "uploaded = 0").toInt()

  override fun pending(limit: Int): List<Event> =
    readableDatabase.rawQuery(
      "SELECT id, at, kind, json FROM events WHERE uploaded = 0 ORDER BY at ASC, id ASC LIMIT ?",
      arrayOf(limit.toString()),
    ).use { c -> buildList { while (c.moveToNext()) add(Event(c.getString(0), c.getLong(1), c.getString(2), c.getString(3))) } }

  override fun lastUploadedSnapshotJson(): String? =
    readableDatabase.rawQuery(
      "SELECT json FROM events WHERE kind = 'snapshot' AND uploaded = $UPLOADED ORDER BY at DESC, id DESC LIMIT 1",
      null,
    ).use { c -> if (c.moveToFirst()) c.getString(0) else null }

  override fun markUploaded(ids: Collection<String>) = mark(ids, UPLOADED)

  override fun markRejected(ids: Collection<String>) = mark(ids, REJECTED)

  /** Rechazados en los últimos 14 días (400 del servidor o JSON ilegible). Solo para el diagnóstico local. */
  fun rejectedCount(): Int =
    DatabaseUtils.queryNumEntries(readableDatabase, "events", "uploaded = $REJECTED").toInt()

  /** Marca los ids en una sola transacción: o quedan todos marcados o ninguno. */
  @Synchronized
  private fun mark(ids: Collection<String>, value: Int) {
    if (ids.isEmpty()) return
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.compileStatement("UPDATE events SET uploaded = $value WHERE id = ?").use { statement ->
        for (id in ids) {
          statement.bindString(1, id)
          statement.executeUpdateDelete()
          statement.clearBindings()
        }
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  /** La racha actual de `plugged` sobre todos los snapshots guardados (ver `PhoneStreaks`), o null si no hay. */
  fun currentStreakStart(): PhoneStreak? =
    readableDatabase.rawQuery(
      "SELECT at, json FROM events WHERE kind = 'snapshot' ORDER BY at DESC, id DESC",
      null,
    ).use { c ->
      PhoneStreaks.current(generateSequence { if (c.moveToNext()) PhoneStreaks.Row(c.getLong(0), c.getString(1)) else null })
    }

  fun lastSnapshotJson(): String? =
    readableDatabase.rawQuery(
      "SELECT json FROM events WHERE kind = 'snapshot' ORDER BY at DESC, id DESC LIMIT 1",
      null,
    ).use { c -> if (c.moveToFirst()) c.getString(0) else null }

  companion object {
    const val RETENTION_MS = 1_209_600_000L

    // Valores de la columna `uploaded`: 0 pendiente, 1 subido (o saltado), 2 rechazado (nunca se reenvía).
    const val UPLOADED = 1
    const val REJECTED = 2

    @Volatile private var instance: EventStore? = null

    fun get(context: Context): EventStore =
      instance ?: synchronized(this) { instance ?: EventStore(context).also { instance = it } }
  }
}
