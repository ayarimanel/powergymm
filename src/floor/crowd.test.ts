import { describe, expect, it } from 'vitest';
import {
  bestHour,
  DEFAULT_HOURLY_CURVE,
  forecastCount,
  groupIntoHistoryPoints,
  gymThresholds,
  hoursForDate,
  hourlyForecast,
  isOpenAt,
  isPresentAt,
  levelFromCount,
  mondayIndex,
  presentCount,
  presentCountByMuscle,
  zoneThresholds,
  type HistoryPoint,
  type WeeklyHours,
} from './crowd';

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const MIN = 60_000;

describe('presence window (75 min)', () => {
  it('is present right after check-in', () => {
    expect(isPresentAt({ startedAt: iso(0) }, Date.now())).toBe(true);
  });

  it('is still present at 74 minutes', () => {
    expect(isPresentAt({ startedAt: iso(-74 * MIN) }, Date.now())).toBe(true);
  });

  it('is no longer present at 75 minutes', () => {
    expect(isPresentAt({ startedAt: iso(-75 * MIN) }, Date.now())).toBe(false);
  });

  it('is not present before check-in happens', () => {
    expect(isPresentAt({ startedAt: iso(10 * MIN) }, Date.now())).toBe(false);
  });

  it('an explicit scan-out ends presence immediately, even inside the 75 min window', () => {
    const rec = { startedAt: iso(-10 * MIN), endedAt: iso(-1 * MIN) };
    expect(isPresentAt(rec, Date.now())).toBe(false);
  });

  it('counts only the still-present records', () => {
    const now = Date.now();
    const records = [
      { startedAt: iso(-10 * MIN) }, // present
      { startedAt: iso(-80 * MIN) }, // expired
      { startedAt: iso(-5 * MIN), endedAt: iso(-1 * MIN) }, // scanned out
    ];
    expect(presentCount(records, now)).toBe(1);
  });

  it('buckets presence by muscle', () => {
    const now = Date.now();
    const records = [
      { startedAt: iso(-10 * MIN), muscle: 'legs' as const },
      { startedAt: iso(-10 * MIN), muscle: 'legs' as const },
      { startedAt: iso(-90 * MIN), muscle: 'legs' as const }, // expired, not counted
      { startedAt: iso(-10 * MIN), muscle: 'back' as const },
    ];
    const byMuscle = presentCountByMuscle(records, now);
    expect(byMuscle.legs).toBe(2);
    expect(byMuscle.back).toBe(1);
    expect(byMuscle.chest).toBe(0);
  });
});

describe('crowd levels', () => {
  it('is calme at or under calmMax', () => {
    expect(levelFromCount(4, { calmMax: 4, busyMin: 10 })).toBe('calme');
  });
  it('is moyen between calmMax and busyMin', () => {
    expect(levelFromCount(5, { calmMax: 4, busyMin: 10 })).toBe('moyen');
    expect(levelFromCount(9, { calmMax: 4, busyMin: 10 })).toBe('moyen');
  });
  it('is plein at or over busyMin', () => {
    expect(levelFromCount(10, { calmMax: 4, busyMin: 10 })).toBe('plein');
  });

  it('gym thresholds scale with capacity', () => {
    const t = gymThresholds(80, 40, 70);
    expect(t).toEqual({ calmMax: 32, busyMin: 56 });
  });

  it('zone thresholds: up to 1x capacity is calm, up to 2x is moyen', () => {
    const t = zoneThresholds(3);
    expect(levelFromCount(3, t)).toBe('calme');
    expect(levelFromCount(4, t)).toBe('moyen');
    expect(levelFromCount(6, t)).toBe('plein');
  });
});

describe('opening hours + special days', () => {
  const weekly: WeeklyHours = {
    0: { open: 6, close: 22 }, 1: { open: 6, close: 22 }, 2: { open: 6, close: 22 },
    3: { open: 6, close: 22 }, 4: { open: 6, close: 22 }, 5: { open: 6, close: 20 }, 6: null,
  };

  it('mondayIndex maps Monday to 0 and Sunday to 6', () => {
    expect(mondayIndex(new Date('2026-09-28T10:00:00'))).toBe(0); // Monday
    expect(mondayIndex(new Date('2026-10-04T10:00:00'))).toBe(6); // Sunday
  });

  it('reads the normal weekly hours', () => {
    const hours = hoursForDate(weekly, [], new Date('2026-09-28T10:00:00')); // Monday
    expect(hours).toEqual({ open: 6, close: 22 });
  });

  it('a day with `null` hours is closed all day', () => {
    const hours = hoursForDate(weekly, [], new Date('2026-10-04T10:00:00')); // Sunday
    expect(hours).toBeNull();
    expect(isOpenAt(hours, 10)).toBe(false);
  });

  it('a special day overrides the weekly hours for that date', () => {
    const specialDays = [{ date: '2026-09-28', open: 6, close: 16, label: 'Aïd', emoji: '🌙' }];
    const hours = hoursForDate(weekly, specialDays, new Date('2026-09-28T10:00:00'));
    expect(hours).toEqual({ open: 6, close: 16, special: specialDays[0] });
  });

  it('isOpenAt respects the close boundary (closes AT closingHour)', () => {
    const hours = { open: 6, close: 22 };
    expect(isOpenAt(hours, 21.9)).toBe(true);
    expect(isOpenAt(hours, 22)).toBe(false);
  });
});

describe('forecast', () => {
  it('falls back to the default curve with no history', () => {
    const r = forecastCount([], 0, 18, 8, DEFAULT_HOURLY_CURVE[18]);
    expect(r).toEqual({ count: DEFAULT_HOURLY_CURVE[18], estimated: true });
  });

  it('averages the same weekday+hour across past weeks', () => {
    const history: HistoryPoint[] = [
      { weekday: 0, hour: 18, count: 30 },
      { weekday: 0, hour: 18, count: 40 },
      { weekday: 0, hour: 19, count: 99 }, // different hour, ignored
      { weekday: 1, hour: 18, count: 99 }, // different weekday, ignored
    ];
    const r = forecastCount(history, 0, 18, 8, 0);
    expect(r).toEqual({ count: 35, estimated: false });
  });

  it('only looks at the last `weeks` occurrences', () => {
    const history: HistoryPoint[] = [
      { weekday: 0, hour: 18, count: 100 }, // too old, dropped
      { weekday: 0, hour: 18, count: 10 },
      { weekday: 0, hour: 18, count: 20 },
    ];
    const r = forecastCount(history, 0, 18, 2, 0);
    expect(r.count).toBe(15);
  });

  it('clips the hourly forecast to opening hours', () => {
    const hourly = hourlyForecast({
      hours: { open: 6, close: 16 },
      history: [],
      weekday: 0,
      weeks: 8,
      thresholds: { calmMax: 10, busyMin: 30 },
      nowHour: 10,
      capacity: 80,
    });
    expect(hourly[0].hour).toBe(6);
    expect(hourly[hourly.length - 1].hour).toBe(15); // close at 16 → last bucket is 15
    expect(hourly.some(h => h.hour >= 16)).toBe(false);
  });

  it('marks hours with no real history as estimated, real history as not', () => {
    const hourly = hourlyForecast({
      hours: { open: 17, close: 19 },
      history: [{ weekday: 0, hour: 17, count: 12 }],
      weekday: 0,
      weeks: 8,
      thresholds: { calmMax: 10, busyMin: 30 },
      nowHour: 17,
      capacity: 80,
    });
    expect(hourly.find(h => h.hour === 17)?.estimated).toBe(false);
    expect(hourly.find(h => h.hour === 18)?.estimated).toBe(true);
  });
});

describe('grouping raw check-in events into history points', () => {
  it('counts events per (date, hour) and attaches the weekday', () => {
    const points = groupIntoHistoryPoints([
      { date: '2026-09-28', hour: 18 }, // Monday
      { date: '2026-09-28', hour: 18 },
      { date: '2026-09-28', hour: 19 },
    ]);
    expect(points).toEqual(
      expect.arrayContaining([
        { weekday: 0, hour: 18, count: 2 },
        { weekday: 0, hour: 19, count: 1 },
      ])
    );
  });
});

describe('best hour', () => {
  const hourly = [
    { hour: 15, count: 20, level: 'moyen' as const, isNow: false, estimated: true },
    { hour: 16, count: 5, level: 'calme' as const, isNow: false, estimated: true },
    { hour: 17, count: 40, level: 'plein' as const, isNow: true, estimated: true },
    { hour: 18, count: 5, level: 'calme' as const, isNow: false, estimated: true },
  ];

  it('picks the calmest hour', () => {
    expect(bestHour(hourly, 15, false)).toBe(16);
  });

  it('when open now, only considers hours from now on, and breaks ties by the soonest', () => {
    expect(bestHour(hourly, 17, true)).toBe(18); // 16h is calmer but already past
  });

  it('returns null with no candidates', () => {
    expect(bestHour([], 10, false)).toBeNull();
  });
});
