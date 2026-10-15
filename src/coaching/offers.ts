/* Coach plans: pure helpers (no React). A plan = a name, the coach's own description, a price. */
import { CoachPricingPlan, CoachProfile } from '../types/database';

export const PLAN_LIMITS = { title: 40, description: 400, price: 10_000 } as const;

export const fmtTnd = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '').replace('.', ',')} DT`;

/** The text under a plan: the coach's description, or what older plans had (period + bullet points). */
export const planText = (p: CoachPricingPlan): string =>
  p.description?.trim() || [p.billingPeriod, ...(p.features ?? [])].filter(Boolean).join(' · ');

export const plansOf = (c: CoachProfile): CoachPricingPlan[] => c.pricingPlans ?? [];

/** Cheapest plan ("À partir de 50 DT"). */
export function fromPrice(c: CoachProfile): number | null {
  const prices = plansOf(c).map(p => p.priceTnd).filter(p => p > 0);
  if (prices.length) return Math.min(...prices);
  return c.hourlyRateTnd > 0 ? c.hourlyRateTnd : null;
}

export const offersPersonal = (c: CoachProfile) => c.personalCoaching ?? (c.hourlyRateTnd > 0 || plansOf(c).length > 0);

/** Save plans on a profile and keep the "à partir de" price in sync. */
export function withPlans(c: CoachProfile, plans: CoachPricingPlan[]): CoachProfile {
  const next: CoachProfile = { ...c, pricingPlans: plans.length ? plans : undefined, hourlyRateTnd: 0 };
  return { ...next, hourlyRateTnd: fromPrice(next) ?? 0, personalCoaching: plans.length ? true : c.personalCoaching };
}

export function planError(p: { title: string; priceTnd: number }): string | null {
  if (p.title.trim().length < 2) return 'Donne un nom à ton plan (ex : Suivi 1 mois).';
  if (!(p.priceTnd > 0)) return 'Indique le prix.';
  if (p.priceTnd > PLAN_LIMITS.price) return 'Ce prix semble trop élevé.';
  return null;
}

/** WhatsApp message the member sends when booking. */
export function bookingMessage(coach: CoachProfile, memberName: string, p: CoachPricingPlan | null): string {
  const hi = `Bonjour ${coach.fullName}, je suis ${memberName}, membre du club.`;
  if (!p) return `${hi} J’aimerais réserver une séance de coaching avec toi. Quand es-tu disponible ?`;
  return `${hi} Je suis intéressé(e) par ton plan « ${p.title} » (${fmtTnd(p.priceTnd)}). Quand peut-on commencer ?`;
}

/** Digits for wa.me (Tunisian 8-digit numbers get the 216 country code). */
export function waDigits(c: CoachProfile): string {
  const d = (c.whatsappNumber || c.contactPhone).replace(/[^0-9]/g, '');
  return d.length === 8 ? `216${d}` : d;
}
