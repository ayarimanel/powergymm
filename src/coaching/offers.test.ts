import { describe, expect, it } from 'vitest';
import { CoachProfile } from '../types/database';
import { bookingMessage, fromPrice, offersPersonal, planError, planText, waDigits, withPlans } from './offers';

const coach = (over: Partial<CoachProfile> = {}): CoachProfile => ({
  id: 'c', fullName: 'Coach Anis', bio: '', yearsExperience: 5, specialties: [], hourlyRateTnd: 0,
  contactPhone: '+216 20 123 456', isAcceptingClients: true, ...over,
});
const discovery = { id: '1', title: 'Séance découverte', priceTnd: 50, description: 'Une heure pour faire le point.' };
const month = { id: 'm', title: 'Suivi 1 mois', priceTnd: 400, description: '3 séances par semaine.' };

describe('coach plans', () => {
  it('a plan is a name, the coach’s words and a price; the card shows the cheapest', () => {
    const c = withPlans(coach(), [month, discovery]);
    expect(fromPrice(c)).toBe(50);
    expect(c.hourlyRateTnd).toBe(50);
    expect(offersPersonal(c)).toBe(true);
    expect(planText(month)).toBe('3 séances par semaine.');
  });

  it('removing every plan turns the price off', () => {
    const c = withPlans(withPlans(coach(), [month]), []);
    expect(c.hourlyRateTnd).toBe(0);
    expect(c.pricingPlans).toBeUndefined();
  });

  it('older plans still show their text', () => {
    expect(planText({ id: 'x', title: 'Suivi', priceTnd: 120, billingPeriod: 'par mois', features: ['Nutrition'] })).toBe('par mois · Nutrition');
  });

  it('needs a name and a price', () => {
    expect(planError({ title: 'Suivi 1 mois', priceTnd: 400 })).toBeNull();
    expect(planError({ title: 'S', priceTnd: 400 })).toMatch(/nom/);
    expect(planError({ title: 'Suivi', priceTnd: 0 })).toMatch(/prix/);
  });

  it('books on WhatsApp with the plan already in the message', () => {
    expect(waDigits(coach({ contactPhone: '20 123 456' }))).toBe('21620123456');
    const msg = bookingMessage(coach(), 'Sami', month);
    expect(msg).toContain('« Suivi 1 mois »');
    expect(msg).toContain('400 DT');
  });
});
