import { Cron } from 'croner';
import type { FastifyBaseLogger } from 'fastify';
import type { AttendanceService } from '../modules/attendance/index.js';
import type { MembershipsService } from '../modules/memberships/index.js';
import type { HabitsService } from '../modules/habits/index.js';

/**
 * Time-based work. Run it on exactly one instance (JOBS_ENABLED=true there only),
 * otherwise reminders go out twice.
 */
export function startJobs(deps: { attendance: AttendanceService; memberships: MembershipsService; habits: HabitsService; log: FastifyBaseLogger }) {
  const run = (name: string, task: () => Promise<number>) => async () => {
    try {
      const n = await task();
      if (n) deps.log.info({ job: name, affected: n }, 'job done');
    } catch (err) {
      deps.log.error({ err, job: name }, 'job failed');
    }
  };

  const jobs = [
    new Cron('*/10 * * * *', { protect: true }, run('expire-check-ins', () => deps.attendance.expireStale())),
    new Cron('0 9 * * *', { protect: true, timezone: 'Africa/Tunis' }, run('membership-reminders', () => deps.memberships.remindExpiring())),
    // Declared subscriptions: nudge at most three times, inside waking hours.
    new Cron('0 10 * * *', { protect: true, timezone: 'Africa/Tunis' }, run('renewal-reminders', () => deps.habits.remindRenewals())),
  ];

  return () => jobs.forEach(j => j.stop());
}
