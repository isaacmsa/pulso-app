package expo.modules.powermonitor

import android.content.ContentValues
import android.content.Context
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** Eventos guardados en el teléfono (14 días). Es la fuente del estado crudo y de la subida. */
class EventStore private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "power_monitor.db", null, 1) {

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

  /** Los eventos desde `sinceMs`, del más nuevo al más viejo, como JSON. */
  fun since(sinceMs: Long, limit: Int = 500): List<String> =
    readableDatabase.rawQuery(
      "SELECT json FROM events WHERE at >= ? ORDER BY at DESC, id DESC LIMIT ?",
      arrayOf(sinceMs.toString(), limit.toString()),
    ).use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }

  fun count(): Int = DatabaseUtils.queryNumEntries(readableDatabase, "events").toInt()

  fun lastSnapshotJson(): String? =
    readableDatabase.rawQuery(
      "SELECT json FROM events WHERE kind = 'snapshot' ORDER BY at DESC, id DESC LIMIT 1",
      null,
    ).use { c -> if (c.moveToFirst()) c.getString(0) else null }

  companion object {
    const val RETENTION_MS = 1_209_600_000L

    @Volatile private var instance: EventStore? = null

    fun get(context: Context): EventStore =
      instance ?: synchronized(this) { instance ?: EventStore(context).also { instance = it } }
  }
}
