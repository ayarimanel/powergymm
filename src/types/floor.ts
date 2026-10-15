/** Types for the redesigned Floor page and its admin ("Live") dashboard. */
import { MuscleGroup } from './database';
import { SpecialDay, WeeklyHours } from '../floor/crowd';

export type { SpecialDay, WeeklyHours };

export interface FloorSettings {
  /** Weekly opening hours, keyed 0 (Monday) … 6 (Sunday). `null` = closed that day. */
  weekly: WeeklyHours;
  specialDays: SpecialDay[];
  /** Equipment capacity per zone, e.g. jambes: 3 racks. Drives that zone's calme/moyen/plein cutoffs. */
  zoneCapacity: Record<MuscleGroup, number>;
  /** % of gym capacity below which the whole gym reads "calme". */
  gymCalmPct: number;
  /** % of gym capacity at/above which the whole gym reads "plein" (between the two is "moyen"). */
  gymBusyPct: number;
}

/** "Prévenez-moi" set from the heat strip, for a muscle (or the whole gym) and/or a target hour. */
export interface CalmAlert {
  id: string;
  userId: string;
  gymId: string;
  muscle: MuscleGroup | null;
  targetHour: number | null;
  active: boolean;
  firedAt?: string;
  createdAt: string;
}

export interface PlannedVisit {
  id: string;
  userId: string;
  gymId: string;
  plannedHour: number;
  /** YYYY-MM-DD, the day this visit is planned for (defaults to today). */
  plannedDate: string;
  createdAt: string;
}
