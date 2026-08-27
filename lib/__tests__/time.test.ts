import { test } from "node:test";
import assert from "node:assert/strict";
import { nowInMelbourne, melbourneDayBoundsUtc } from "../time";

test("nowInMelbourne returns AEST offset (+10) in August", () => {
  const at = new Date("2026-08-27T11:52:14.000Z");
  const { date, time } = nowInMelbourne(at);
  assert.equal(date, "2026-08-27");
  assert.equal(time, "21:52:14");
});

test("nowInMelbourne returns AEDT offset (+11) in January", () => {
  const at = new Date("2026-01-15T03:00:00.000Z");
  const { date, time } = nowInMelbourne(at);
  assert.equal(date, "2026-01-15");
  assert.equal(time, "14:00:00");
});

test("melbourneDayBoundsUtc gives a 24h window starting at Melbourne midnight (AEST)", () => {
  const { start, end } = melbourneDayBoundsUtc("2026-08-27");
  assert.equal(start, "2026-08-26T14:00:00.000Z");
  assert.equal(end, "2026-08-27T14:00:00.000Z");
  assert.equal(new Date(end).getTime() - new Date(start).getTime(), 24 * 60 * 60 * 1000);
});

test("melbourneDayBoundsUtc shifts an hour earlier during daylight saving (AEDT)", () => {
  const { start, end } = melbourneDayBoundsUtc("2026-01-15");
  assert.equal(start, "2026-01-14T13:00:00.000Z");
  assert.equal(end, "2026-01-15T13:00:00.000Z");
});

test("a submission at 09:00 AEST falls inside that day's Melbourne bounds, not UTC's", () => {
  // 09:00 AEST on 2026-08-27 is 2026-08-26T23:00:00Z - still the previous UTC day,
  // which is exactly the bug this module exists to prevent.
  const submittedAt = new Date("2026-08-26T23:00:00.000Z");
  const { start, end } = melbourneDayBoundsUtc("2026-08-27");
  assert.ok(submittedAt.toISOString() >= start && submittedAt.toISOString() < end);
});
