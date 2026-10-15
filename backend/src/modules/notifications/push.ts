export interface PushMessage {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Sends push notifications; returns the tokens the push service says are dead. */
export interface PushSender {
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

export const noopPushSender: PushSender = { send: async () => ({ invalidTokens: [] }) };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo's push service (handles APNs and FCM for us). Batches of 100, as Expo requires. */
export function expoPushSender(log: { warn: (obj: object, msg: string) => void }): PushSender {
  return {
    async send(messages) {
      const invalidTokens: string[] = [];
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100).map(m => ({ ...m, sound: 'default' }));
        try {
          const res = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(batch),
          });
          const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
          json.data?.forEach((ticket, j) => {
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[j]!.to);
          });
        } catch (err) {
          log.warn({ err }, 'expo push failed');
        }
      }
      return { invalidTokens };
    },
  };
}
