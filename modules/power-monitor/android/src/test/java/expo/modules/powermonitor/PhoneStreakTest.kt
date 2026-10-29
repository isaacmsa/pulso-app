package expo.modules.powermonitor

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PhoneStreakTest {
  private val minute = 60_000L
  private val start = 1_793_000_000_000L

  private fun row(at: Long, plugged: Boolean) =
    PhoneStreaks.Row(at, """{"kind":"snapshot","id":"x-$at","at":$at,"plugged":$plugged,"onWifi":true}""")

  @Test
  fun `sin snapshots no hay racha`() {
    assertNull(PhoneStreaks.current(emptySequence()))
  }

  @Test
  fun `la racha empieza en el primer snapshot despues del ultimo distinto`() {
    // Del más nuevo al más viejo, como los lee EventStore.
    val rows = sequenceOf(
      row(start + 30 * minute, false),
      row(start + 20 * minute, false),
      row(start + 10 * minute, true),
      row(start, false),
    )
    val streak = PhoneStreaks.current(rows)!!
    assertEquals(start + 20 * minute, streak.since)
    assertEquals(start + 30 * minute, streak.newest.at)
  }

  @Test
  fun `si ningun snapshot es distinto, la racha empieza en el mas viejo guardado`() {
    val rows = sequenceOf(row(start + 20 * minute, true), row(start + 10 * minute, true), row(start, true))
    assertEquals(start, PhoneStreaks.current(rows)!!.since)
  }

  // El relevo de C cada 9 min y el latido cada 15 llenan 500 eventos en unos 2 días: una semana enchufado son ~1800.
  @Test
  fun `una racha de una semana, con mucho mas de 500 eventos, empieza hace una semana`() {
    val weekAgo = start
    val now = start + 7 * 24 * 60 * minute
    val streak = generateSequence(now) { it - 5 * minute }.takeWhile { it >= weekAgo }.map { row(it, true) } +
      sequenceOf(row(weekAgo - minute, false))
    assertEquals(2018, streak.count())
    val result = PhoneStreaks.current(streak)!!
    assertEquals(weekAgo, result.since)
    assertEquals(now, result.newest.at)
  }

  @Test
  fun `un snapshot ilegible no corta ni empieza la racha`() {
    val rows = sequenceOf(
      PhoneStreaks.Row(start + 30 * minute, "no-json"),
      row(start + 20 * minute, true),
      PhoneStreaks.Row(start + 15 * minute, "{}"),
      row(start + 10 * minute, true),
      row(start, false),
    )
    val streak = PhoneStreaks.current(rows)!!
    assertEquals(start + 20 * minute, streak.newest.at)
    assertEquals(start + 10 * minute, streak.since)
  }

  @Test
  fun `el JSON para JS lleva el snapshot mas nuevo y el inicio de la racha`() {
    val streak = PhoneStreaks.current(sequenceOf(row(start + minute, false), row(start, false)))!!
    val json = JSONObject(PhoneStreaks.json(streak))
    assertEquals(start, json.getLong("since"))
    assertEquals(start + minute, json.getJSONObject("snapshot").getLong("at"))
    assertEquals(false, json.getJSONObject("snapshot").getBoolean("plugged"))
  }
}
