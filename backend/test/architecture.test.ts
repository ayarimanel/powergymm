import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keeps the modular monolith modular: a module may import another module only
 * through its index.ts (its public API), never its repository or tables.
 */
const MODULES = join(import.meta.dirname, '..', 'src', 'modules');

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? filesIn(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));

describe('module boundaries', () => {
  const modules = readdirSync(MODULES);

  for (const mod of modules) {
    it(`${mod} only uses other modules' public API`, () => {
      const violations: string[] = [];
      for (const file of filesIn(join(MODULES, mod))) {
        for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '(\.\.\/[^']+)'/g)) {
          const m = spec!.match(/^\.\.\/([a-z]+)\/(.+)$/);
          if (m && modules.includes(m[1]!) && m[1] !== mod && m[2] !== 'index.js') {
            violations.push(`${relative(MODULES, file)} → ${spec}`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  }

  it('each module queries only its own tables', () => {
    const owners: Record<string, string[]> = {
      clubs: ['gyms', 'announcements'],
      identity: ['profiles', 'staffPermissions'],
      memberships: ['memberships'],
      attendance: ['checkIns'],
      classes: ['groupClasses', 'classSessions', 'classBookings'],
      coaching: ['coachProfiles', 'coachPlans', 'coachTransformations'],
      community: ['posts', 'postComments', 'postLikes', 'postReports'],
      journal: ['workouts', 'workoutSets', 'customExercises'],
      shop: ['products', 'reservations'],
      notifications: ['notifications', 'pushDevices'],
      analytics: [], // composes other modules' counts; owns no table
      habits: ['memberProfiles'],
    };
    const violations: string[] = [];
    for (const mod of modules) {
      for (const file of filesIn(join(MODULES, mod))) {
        const src = readFileSync(file, 'utf8');
        const schemaImport = src.match(/import \{([^}]+)\} from '\.\.\/\.\.\/shared\/db\/schema\.js'/);
        if (!schemaImport) continue;
        const tables = schemaImport[1]!.split(',').map(s => s.trim()).filter(s => s && !s.startsWith('type ') && /^[a-z]/.test(s));
        for (const table of tables) {
          if (!(owners[mod] ?? []).includes(table)) violations.push(`${relative(MODULES, file)} uses ${table}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
