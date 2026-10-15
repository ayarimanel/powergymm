/**
 * Two daily nudges, both built here so their wording stays in one place:
 *
 *  - the quote of the day, to get someone off the sofa;
 *  - "ce que tu as aujourd'hui": the class booked, the visit planned, the muscle
 *    left untouched for too long.
 *
 * Pure on purpose: the screen decides when to send, this file only decides what
 * to say. The quotes are written for this app — none is attributed to anyone,
 * so nobody is quoted saying something they never said.
 */

export interface TodayInputs {
  /** Classes the member booked for today, already filtered to today. */
  classes: { title: string; time: string; coachName: string }[];
  /** Hour the member said he would come today, if he planned one. */
  plannedHour: number | null;
  /** Muscle he has not trained in a while, with how long it has been. */
  staleMuscle: { label: string; days: number } | null;
  /** Days left on the membership; negative is expired, null is unknown. */
  membershipDaysLeft: number | null;
  /** Current streak, to say something worth keeping. */
  streak: number;
  /** Whether he already checked in today: changes the whole tone. */
  checkedInToday: boolean;
}

export interface Brief {
  title: string;
  body: string;
}

/* ---------- quotes ---------- */

/** Written for the app, deliberately unattributed. */
export const QUOTES: string[] = [
  'La séance que tu ne veux pas faire est celle qui compte le plus.',
  'Personne ne soulève à ta place. Personne ne progresse à ta place non plus.',
  'Une heure aujourd’hui vaut mieux que trois heures la semaine prochaine.',
  'Tu ne regretteras jamais d’y être allé. Seulement de ne pas y être allé.',
  'Le corps suit toujours. C’est la tête qui décide.',
  'Commence léger, mais commence.',
  'La régularité bat la motivation, tous les jours de la semaine.',
  'Chaque répétition de plus, c’est demain qui devient plus facile.',
  'Il n’y a pas de mauvaise séance. Il y a la séance et l’absence.',
  'Ce poids était lourd le mois dernier. Souviens-toi de ça.',
  'Deux jours d’arrêt, ça va. Trois, ça devient une habitude.',
  'Les résultats aiment ceux qui reviennent.',
  'Tu n’as pas besoin d’être motivé. Tu as besoin d’y aller.',
  'Le progrès est lent quand on le regarde. Rapide quand on l’oublie.',
  'Fatigué, c’est normal. À l’heure, c’est un choix.',
  'Le meilleur moment pour commencer, c’était hier. Le deuxième, c’est maintenant.',
  'Fais la série qui te fait peur en premier.',
  'Ta seule concurrence porte tes chaussures.',
  'La forme d’abord, le poids ensuite. Toujours.',
  'Un jour sans excuse vaut dix jours de bonnes intentions.',
  'Le repos fait partie du programme. L’abandon, non.',
  'Tu es plus proche que tu ne le crois. Continue.',
  'Les grands résultats sont des petites séances empilées.',
  'Entre vouloir et avoir, il y a la salle.',
];

/**
 * One quote per day, the same for everyone on a given day, and the list is
 * walked in order so nothing repeats before the whole set has been used.
 */
export const quoteOfTheDay = (isoDay: string, quotes: string[] = QUOTES): string => {
  const days = Math.floor(new Date(`${isoDay}T00:00:00`).getTime() / 86400000);
  return quotes[((days % quotes.length) + quotes.length) % quotes.length]!;
};

export const quoteBrief = (isoDay: string): Brief => ({
  title: 'Ta dose du jour 💪',
  body: quoteOfTheDay(isoDay),
});

/* ---------- today ---------- */

const hourLabel = (h: number) => `${h}h`;

const list = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;

/**
 * What the member has today, in one line. Returns null when there is genuinely
 * nothing to say — an empty reminder is worse than no reminder.
 */
export const todayBrief = (i: TodayInputs): Brief | null => {
  const bits: string[] = [];

  for (const c of i.classes) bits.push(`${c.title} à ${c.time} avec ${c.coachName}`);
  if (!i.classes.length && i.plannedHour !== null) bits.push(`ta séance prévue vers ${hourLabel(i.plannedHour)}`);
  if (i.staleMuscle) bits.push(`${i.staleMuscle.label.toLowerCase()} (rien depuis ${i.staleMuscle.days} jours)`);

  // An expiring membership is worth one line, but never a threat.
  if (i.membershipDaysLeft !== null && i.membershipDaysLeft >= 0 && i.membershipDaysLeft <= 3) {
    bits.push(`abonnement à renouveler (${i.membershipDaysLeft} j)`);
  }

  if (!bits.length) return null;

  if (i.checkedInToday) {
    // He already came: acknowledge it instead of nagging.
    return { title: 'Séance faite ✓', body: `Il te restait : ${list(bits)}. À demain !` };
  }

  const title = i.classes.length
    ? 'Tu as un cours aujourd’hui'
    : i.streak > 1
      ? `Jour ${i.streak + 1} de ta série 🔥`
      : 'Ton programme du jour';

  return { title, body: `Aujourd’hui : ${list(bits)}.` };
};

/** Today's booked classes for one member, from the weekly schedule. */
export const classesToday = (
  classes: { title: string; time: string; coachName: string; day: string; bookings: Record<string, string>; cancelledSessions?: Record<string, unknown> }[],
  userId: string,
  isoDay: string,
  dayLabel: string
) =>
  classes
    .filter(c => c.day === dayLabel && c.bookings[userId] === isoDay && !c.cancelledSessions?.[isoDay])
    .map(c => ({ title: c.title, time: c.time, coachName: c.coachName }))
    .sort((a, b) => a.time.localeCompare(b.time));
