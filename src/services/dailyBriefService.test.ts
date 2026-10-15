import { describe, expect, it } from 'vitest';
import { QUOTES, TodayInputs, classesToday, quoteOfTheDay, todayBrief } from './dailyBriefService';

const base: TodayInputs = {
  classes: [],
  plannedHour: null,
  staleMuscle: null,
  membershipDaysLeft: null,
  streak: 0,
  checkedInToday: false,
};

describe('quote of the day', () => {
  it('gives the same quote all day, and a different one tomorrow', () => {
    expect(quoteOfTheDay('2026-10-02')).toBe(quoteOfTheDay('2026-10-02'));
    expect(quoteOfTheDay('2026-10-02')).not.toBe(quoteOfTheDay('2026-10-03'));
  });

  it('uses every quote before repeating one', () => {
    const seen = new Set<string>();
    for (let d = 0; d < QUOTES.length; d++) {
      const day = new Date(Date.UTC(2026, 9, 2 + d)).toISOString().slice(0, 10);
      seen.add(quoteOfTheDay(day));
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it('comes back round after a full cycle', () => {
    const day = (d: number) => new Date(Date.UTC(2026, 9, 2 + d)).toISOString().slice(0, 10);
    expect(quoteOfTheDay(day(QUOTES.length))).toBe(quoteOfTheDay(day(0)));
  });

  it('attributes nothing to anyone', () => {
    for (const q of QUOTES) {
      expect(q).not.toMatch(/—|--|\bArnold\b|\bAli\b/);
    }
  });
});

describe('today brief', () => {
  it('says nothing when there is nothing to say', () => {
    expect(todayBrief(base)).toBeNull();
  });

  it('leads with a booked class', () => {
    const b = todayBrief({ ...base, classes: [{ title: 'HIIT', time: '19:00', coachName: 'Coach Sonia' }] });
    expect(b?.title).toBe('Tu as un cours aujourd’hui');
    expect(b?.body).toContain('HIIT à 19:00 avec Coach Sonia');
  });

  it('falls back to the planned visit when no class is booked', () => {
    const b = todayBrief({ ...base, plannedHour: 18 });
    expect(b?.body).toContain('ta séance prévue vers 18h');
  });

  it('does not mention the planned hour when a class already covers today', () => {
    const b = todayBrief({ ...base, plannedHour: 18, classes: [{ title: 'Yoga', time: '18:30', coachName: 'C' }] });
    expect(b?.body).not.toContain('prévue vers');
  });

  it('names the streak it is protecting', () => {
    const b = todayBrief({ ...base, streak: 4, staleMuscle: { label: 'Dos', days: 9 } });
    expect(b?.title).toBe('Jour 5 de ta série 🔥');
    expect(b?.body).toContain('dos (rien depuis 9 jours)');
  });

  it('congratulates instead of nagging once he has come', () => {
    const b = todayBrief({ ...base, checkedInToday: true, staleMuscle: { label: 'Jambes', days: 8 } });
    expect(b?.title).toBe('Séance faite ✓');
    expect(b?.body).toContain('À demain');
  });

  it('mentions an expiring membership only in the last three days', () => {
    expect(todayBrief({ ...base, membershipDaysLeft: 2 })?.body).toContain('abonnement à renouveler');
    expect(todayBrief({ ...base, membershipDaysLeft: 9 })).toBeNull();
    // Already expired: the daily brief stays quiet, the membership reminder owns that.
    expect(todayBrief({ ...base, membershipDaysLeft: -4 })).toBeNull();
  });

  it('joins several items in readable French', () => {
    const b = todayBrief({
      ...base,
      classes: [{ title: 'HIIT', time: '19:00', coachName: 'Sonia' }],
      staleMuscle: { label: 'Dos', days: 10 },
      membershipDaysLeft: 1,
    });
    expect(b?.body).toContain(' et ');
    expect(b?.body?.endsWith('.')).toBe(true);
  });
});

describe('classes booked today', () => {
  const classes: { title: string; time: string; coachName: string; day: string; bookings: Record<string, string>; cancelledSessions?: Record<string, unknown> }[] = [
    { title: 'HIIT', time: '19:00', coachName: 'Sonia', day: 'Lun', bookings: { u1: '2026-10-05' } },
    { title: 'Yoga', time: '08:00', coachName: 'Sonia', day: 'Lun', bookings: { u1: '2026-10-05', u2: '2026-10-05' } },
    { title: 'Zumba', time: '18:00', coachName: 'Anis', day: 'Mar', bookings: { u1: '2026-10-06' } },
  ];

  it('returns only this member, this day, sorted by time', () => {
    const today = classesToday(classes, 'u1', '2026-10-05', 'Lun');
    expect(today.map(c => c.title)).toEqual(['Yoga', 'HIIT']);
  });

  it('skips a cancelled session', () => {
    const withCancel = [{ ...classes[0]!, cancelledSessions: { '2026-10-05': { reason: 'coach malade' } } }];
    expect(classesToday(withCancel, 'u1', '2026-10-05', 'Lun')).toHaveLength(0);
  });

  it('ignores another member booking', () => {
    expect(classesToday(classes, 'u2', '2026-10-05', 'Lun').map(c => c.title)).toEqual(['Yoga']);
  });
});
