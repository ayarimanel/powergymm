import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), multiSet: vi.fn() } }));

import { CoachProfile, MuscleGroup } from '../types/database';
import { InsightEvent, InsightInputs, coachGaps, peakShift, quietWindow, weeklySummary, zoneSaturation } from './ownerInsights';
import { localDateStr } from './crowd';

const NOW = new Date('2026-10-01T12:00:00'); // a Thursday
const day = (ago: number) => localDateStr(new Date(+NOW - ago * 864e5));
const weekly = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, { open: 6, close: 22 }])) as InsightInputs['weekly'];
const zoneCapacity: Record<MuscleGroup, number> = { chest: 4, back: 4, shoulders: 3, arms: 4, legs: 3, cardio: 8 };

/** n entries on each of the given days-ago, at that hour and zone. */
const entries = (days: number[], hour: number, n: number, muscle: MuscleGroup = 'chest'): InsightEvent[] =>
  days.flatMap(d => Array.from({ length: n }, () => ({ date: day(d), hour, muscle })));
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

const coach = (over: Partial<CoachProfile>): CoachProfile => ({
  id: 'c', fullName: 'Coach', bio: '', yearsExperience: 1, specialties: [], hourlyRateTnd: 0, contactPhone: '', isAcceptingClients: true, onFloor: true, status: 'approved', ...over,
});

describe('owner insights', () => {
  it('flags a zone with more people than posts, with its hours and days', () => {
    // 6 leg entries at 19h and 20h every day for 4 weeks → ≈ 7.5 people for 3 racks
    const events = [...entries(range(1, 29), 19, 6, 'legs'), ...entries(range(1, 29), 20, 6, 'legs'), ...entries(range(1, 29), 19, 1, 'cardio')];
    const [legs, ...others] = zoneSaturation({ events, now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [] });
    expect(legs).toMatchObject({ muscle: 'legs', from: 19, to: 21, days: 7, capacity: 3 });
    expect(legs.worstLoad).toBeGreaterThanOrEqual(7);
    expect(legs.text).toContain('Zone jambes saturée 19h–21h');
    expect(others).toHaveLength(0); // cardio has 8 machines for ≈ 1 person
  });

  it('measures visits that left the peak', () => {
    const before = [...entries(range(7, 35), 19, 6), ...entries(range(7, 35), 15, 2)];
    const week = [...entries(range(0, 7), 19, 3), ...entries(range(0, 7), 15, 5)];
    const shift = peakShift({ events: [...before, ...week], now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [] })!;
    expect(shift.shareBefore).toBeGreaterThan(shift.shareThisWeek);
    expect(shift.movedVisits).toBeGreaterThan(0);
    expect(shift.text).toMatch(/ont quitté le pic/);
  });

  it('lists busy hours that no floor coach covers', () => {
    const events = entries(range(1, 29), 19, 10);
    const morning = coach({ availabilityDays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], availabilityHours: '07:00 – 12:00' });
    expect(coachGaps({ events, now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [morning] }).length).toBeGreaterThan(0);
    const evening = coach({ availabilityDays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], availabilityHours: '17:00 – 21:00' });
    expect(coachGaps({ events, now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [evening] })).toHaveLength(0);
  });

  it('finds the quiet window for a class or an off-peak offer', () => {
    const busy = range(7, 21).filter(h => h < 14 || h > 15).flatMap(h => entries(range(1, 29), h, 4));
    const q = quietWindow({ events: busy, now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [] })!;
    expect(q).toMatchObject({ from: 14, to: 16 });
  });

  it('writes the week in a few lines, ready for WhatsApp', () => {
    const events = [...entries(range(0, 7), 19, 4), ...entries(range(7, 14), 19, 2), ...entries(range(14, 35), 19, 3)];
    const s = weeklySummary({ events, now: NOW, capacity: 80, zoneCapacity, weekly, coaches: [] }, 'Olympe');
    expect(s.visits).toBe(28);
    expect(s.change).toBe(100);
    expect(s.text.split('\n')[0]).toBe('📊 Olympe · résumé de la semaine');
  });
});
