import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ENABLED_KEY = '@gym_app_reminders_enabled_v1';
const IDS_KEY = '@gym_app_reminder_ids_v1';

/** Local reminders only work on the phone app (not in the browser). */
export const remindersSupported = Platform.OS !== 'web';

export type ReminderKind = 'streak' | 'membership' | 'muscle' | 'renewal' | 'calm' | 'quote' | 'agenda';

const at = (base: Date, hour: number, addDays = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const readIds = async (): Promise<Record<string, string>> => {
  try {
    return JSON.parse((await AsyncStorage.getItem(IDS_KEY)) ?? '{}');
  } catch {
    return {};
  }
};

export const NotificationService = {
  init: () => {
    if (!remindersSupported) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  },

  isEnabled: async () => remindersSupported && (await AsyncStorage.getItem(ENABLED_KEY)) === '1',

  /** Asks the OS for permission; returns whether reminders are now on. */
  enable: async (): Promise<boolean> => {
    if (!remindersSupported) return false;
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    await AsyncStorage.setItem(ENABLED_KEY, granted ? '1' : '0');
    return granted;
  },

  disable: async () => {
    await AsyncStorage.setItem(ENABLED_KEY, '0');
    if (remindersSupported) await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(IDS_KEY);
  },

  /** Replace (or clear, when date is null) one reminder. */
  schedule: async (kind: ReminderKind, date: Date | null, title: string, body: string) => {
    if (!remindersSupported || !(await NotificationService.isEnabled())) return;
    const ids = await readIds();
    if (ids[kind]) await Notifications.cancelScheduledNotificationAsync(ids[kind]).catch(() => {});
    delete ids[kind];
    if (date && date.getTime() > Date.now()) {
      ids[kind] = await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  },

  /** "Ta série t'attend" at 18:00 — today if he has not checked in yet, otherwise tomorrow. */
  planStreak: (streak: number, checkedInToday: boolean) => {
    const now = new Date();
    const todayEvening = at(now, 18);
    const date = !checkedInToday && now < todayEvening ? todayEvening : at(now, 18, 1);
    return NotificationService.schedule('streak', date, 'Ta série t’attend 🔥', streak > 0 ? `Ne casse pas ta série de ${streak} jour${streak > 1 ? 's' : ''} : passe au club aujourd’hui.` : 'Une séance aujourd’hui ? Le club t’attend.');
  },

  /** Membership ends in ≤ 5 days → nudge tomorrow at 10:00. */
  planMembership: (daysLeft: number | null) => {
    if (daysLeft === null || daysLeft > 5) return NotificationService.schedule('membership', null, '', '');
    const now = new Date();
    return NotificationService.schedule(
      'membership',
      at(now, 10, 1),
      'Ton abonnement arrive à échéance',
      daysLeft < 0 ? 'Il a expiré : passe à l’accueil pour le renouveler.' : `Il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. Pense à le renouveler.`
    );
  },

  /** A muscle group not trained for a while → nudge tomorrow at 17:00. */
  planMuscle: (label: string | null, days: number) => {
    if (!label) return NotificationService.schedule('muscle', null, '', '');
    return NotificationService.schedule('muscle', at(new Date(), 17, 1), `Et si on travaillait ${label.toLowerCase()} ?`, `Ça fait ${days} jours : bonne idée de le travailler aujourd’hui.`);
  },

  /** The quote of the day, at 07:00 — before the day gets in the way. */
  planQuote: (brief: { title: string; body: string } | null) => {
    if (!brief) return NotificationService.schedule('quote', null, '', '');
    const now = new Date();
    const sevenToday = at(now, 7);
    return NotificationService.schedule('quote', now < sevenToday ? sevenToday : at(now, 7, 1), brief.title, brief.body);
  },

  /**
   * "Ce que tu as aujourd'hui" at 08:00. Passing null clears it, so a member
   * with nothing on gets silence rather than an empty reminder.
   */
  planToday: (brief: { title: string; body: string } | null) => {
    if (!brief) return NotificationService.schedule('agenda', null, '', '');
    const now = new Date();
    const eightToday = at(now, 8);
    return NotificationService.schedule('agenda', now < eightToday ? eightToday : at(now, 8, 1), brief.title, brief.body);
  },
};
