import { colors, Level } from '../theme';
import { CrowdLevel } from './crowd';

/** Maps the Floor engine's calme/moyen/plein onto the app's existing green/amber/red palette. */
const LEVEL_TO_TINT: Record<CrowdLevel, Level> = { calme: 'green', moyen: 'amber', plein: 'red' };

export const levelTint = (level: CrowdLevel) => colors[LEVEL_TO_TINT[level]];
