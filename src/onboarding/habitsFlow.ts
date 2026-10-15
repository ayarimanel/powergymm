/**
 * Which cards the questionnaire shows, in order, and the summary it ends on.
 * Pure: the screen only renders what this decides.
 */
import {
  FocusMuscle,
  HabitsProfile,
  SubDuration,
  TrainingStyle,
  UsualSlot,
  fromISO,
} from './habitsModel';

export type CardId = 'welcome' | 'days' | 'time' | 'style' | 'focus' | 'paid_when' | 'paid_len' | 'notifications' | 'done';

/** What the club tells the questionnaire. Read from gym config. */
export interface ClubRules {
  openDays: number[]; // 0 = Monday … 6 = Sunday
  openingHour: number;
  closingHour: number;
  durationsSold: SubDuration[];
  /** Every membership ends on the last day of the month: the two payment cards make no sense. */
  endOfMonthBilling: boolean;
  membershipsInApp: boolean;
}

export const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DAY_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export const SLOTS: { id: UsualSlot; label: string; from: number; to: number }[] = [
  { id: 'early', label: '🌅 Tôt · 6h–9h', from: 6, to: 9 },
  { id: 'morning', label: '☀️ Matin · 9h–12h', from: 9, to: 12 },
  { id: 'noon', label: '🍽️ Midi · 12h–14h', from: 12, to: 14 },
  { id: 'afternoon', label: '🌤️ Après-midi · 14h–17h', from: 14, to: 17 },
  { id: 'evening', label: '🌆 Soir · 17h–20h', from: 17, to: 20 },
  { id: 'late', label: '🌙 Tard · 20h–22h', from: 20, to: 22 },
];

export const STYLES: { id: TrainingStyle; label: string }[] = [
  { id: 'split', label: '💪 Un muscle par séance' },
  { id: 'upper_lower', label: '↕️ Haut du corps / bas du corps' },
  { id: 'full_body', label: '🔁 Tout le corps à chaque fois' },
  { id: 'cardio', label: '🏃 Surtout du cardio' },
  { id: 'classes', label: '🎵 Surtout les cours' },
  { id: 'beginner', label: '🌱 Je débute' },
];

export const FOCUS: { id: FocusMuscle; label: string }[] = [
  { id: 'pecs', label: 'Pectoraux' },
  { id: 'dos', label: 'Dos' },
  { id: 'jambes', label: 'Jambes' },
  { id: 'epaules', label: 'Épaules' },
  { id: 'bras', label: 'Bras' },
  { id: 'abdos', label: 'Abdos' },
  { id: 'cardio', label: 'Cardio' },
];

export const PAID_WHEN_LABELS: { id: 'this_week' | 'w1_2' | 'w3_4' | 'over_month' | 'unknown'; label: string }[] = [
  { id: 'this_week', label: 'Cette semaine' },
  { id: 'w1_2', label: 'Il y a 1–2 semaines' },
  { id: 'w3_4', label: 'Il y a 3–4 semaines' },
  { id: 'over_month', label: "Plus d'un mois" },
  { id: 'unknown', label: 'Je ne sais plus' },
];

export const DURATION_LABELS: { id: SubDuration; label: string }[] = [
  { id: '1m', label: '1 mois' },
  { id: '3m', label: '3 mois' },
  { id: '6m', label: '6 mois' },
  { id: '1y', label: '1 an' },
  { id: 'pass', label: 'Séance / carnet' },
];

/** Only the slots the club is actually open for. */
export const slotsFor = (rules: ClubRules) =>
  SLOTS.filter(s => s.to > rules.openingHour && s.from < rules.closingHour);

/** Focus only makes sense when the member trains muscle by muscle. */
export const needsFocus = (style: TrainingStyle | null) => style === 'split' || style === 'upper_lower';

/**
 * The cards for this member, in order. Card 4 drops out when it does not apply,
 * and the payment pair drops out when the club bills to the end of the month,
 * so the progress dots never promise a card that will not come.
 */
export const cardsFor = (rules: ClubRules, style: TrainingStyle | null): CardId[] => {
  const cards: CardId[] = ['welcome', 'days', 'time', 'style'];
  if (needsFocus(style)) cards.push('focus');
  if (!rules.endOfMonthBilling) cards.push('paid_when', 'paid_len');
  cards.push('notifications', 'done');
  return cards;
};

/** Dots count questions only: the welcome and the summary are not steps. */
export const dotsFor = (cards: CardId[]): CardId[] => cards.filter(c => c !== 'welcome' && c !== 'done');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "début décembre" / "mi-décembre" / "fin décembre": the date is an estimate, so the wording is too. */
export const vagueDate = (iso: string): string => {
  const d = fromISO(iso);
  const day = d.getDate();
  const part = day <= 10 ? 'début' : day <= 20 ? 'mi-' : 'fin';
  const month = MONTHS[d.getMonth()];
  return part === 'mi-' ? `mi-${month}` : `${part} ${month}`;
};

const listFr = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;

/** The lines on the last card: only what the member actually answered. */
export const summaryLines = (p: HabitsProfile): string[] => {
  const lines: string[] = [];

  const slot = SLOTS.find(s => s.id === p.usualSlot);
  const when = p.usualDaysVaries
    ? 'Ça change chaque semaine'
    : p.usualDays?.length
      ? listFr(p.usualDays.slice().sort((a, b) => a - b).map(d => DAY_FULL[d]))
      : '';
  const timePart = slot ? slot.label.replace(/^\S+\s/, '').split(' · ')[0].toLowerCase() : p.usualSlot === 'varies' ? 'horaire variable' : '';
  if (when || timePart) lines.push(`📅 ${[when, timePart].filter(Boolean).join(' · ')}`);

  const style = STYLES.find(s => s.id === p.trainingStyle);
  if (style) {
    const focus = p.focusMuscles.length
      ? ` · surtout ${listFr(p.focusMuscles.map(f => FOCUS.find(x => x.id === f)!.label.toLowerCase()))}`
      : '';
    lines.push(`${style.label}${focus}`);
  }

  if (p.subscriptionEndsAt) lines.push(`⏳ Abonnement jusqu'à ${vagueDate(p.subscriptionEndsAt)}`);

  return lines;
};
