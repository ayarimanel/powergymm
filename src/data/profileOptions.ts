import { GenderType, TrainingTimeSlot } from '../types/database';

/** Shared between Onboarding and the account settings, so editing later offers the same choices. */
export const GOALS = ['Prendre du muscle', 'Perdre du poids', 'Rester en forme', 'Gagner en force', 'Préparer une compétition'];

export const GENDERS: { id: GenderType; label: string }[] = [
  { id: 'male', label: 'Homme' },
  { id: 'female', label: 'Femme' },
];

export const TIMES: { id: TrainingTimeSlot; label: string }[] = [
  { id: 'morning', label: 'Matin' },
  { id: 'afternoon', label: 'Après-midi' },
  { id: 'evening', label: 'Soir' },
];
