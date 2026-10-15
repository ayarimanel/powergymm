import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { CustomExercise, Workout, exById, num, setCustomExercises } from './journalLogic';
import { migrateOldJournal } from './journalMigration';

/* =========================================================
   Offline-first data for the Journal.
   - Everything is written to the phone first (AsyncStorage), so logging never waits for the network.
   - Changes go into an "outbox" and are sent to the server when the connection is back.
   - Ids are created on the phone (uuid), the server stores them as-is: sending twice is harmless (idempotent PUT).
   ========================================================= */

const cacheKey = (u: string) => `@journal_cache_v1_${u}`; // { history, customs, syncedAt }
const outboxKey = (u: string) => `@journal_outbox_v1_${u}`; // [{ opId, type, payload, tries }]
const draftKey = (u: string) => `@journal_draft_v1_${u}`;

type Op =
  | { opId: string; type: 'saveWorkout'; payload: Workout; tries: number }
  | { opId: string; type: 'deleteWorkout'; payload: { id: string }; tries: number }
  | { opId: string; type: 'createExercise'; payload: CustomExercise; tries: number };

interface Cache {
  history: Workout[];
  customs: CustomExercise[];
  syncedAt: string | null;
}

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'local';
export interface SyncInfo {
  state: SyncState;
  pending: number;
  lastSync: string | null;
  retry: () => void;
}

export type JournalRequest = (method: string, path: string, body?: unknown) => Promise<any>;

const readJson = async <T,>(k: string, d: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) ?? d : d;
  } catch {
    return d;
  }
};
const writeJson = (k: string, v: unknown) => AsyncStorage.setItem(k, JSON.stringify(v)).catch(() => {});

/** RFC 4122 v4 uuid: the server stores these ids as-is. */
export const newId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Authenticated call to the backend (Bearer = Supabase session token).
 * null while the app has no backend configured: the Journal then keeps everything on the phone.
 */
export const defaultJournalRequest: JournalRequest | null =
  API_URL && supabase
    ? async (method, path, body) => {
        const { data } = await supabase!.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          const err = new Error('not signed in') as Error & { status?: number };
          throw err; // no status = treated like "offline": the change stays queued
        }
        const res = await fetch(`${API_URL}/v1/journal${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        return res.status === 204 ? null : res.json();
      }
    : null;

/** What the server stores: validated sets only, numbers as numbers, and each exercise's muscle (for its suggestion). */
const toServer = (w: Workout) => ({
  ...w,
  exercises: w.exercises.map(e => ({
    exerciseId: e.exerciseId,
    muscle: exById(e.exerciseId)?.muscle ?? null,
    sets: e.sets
      .filter(s => s.done)
      .map(s =>
        exById(e.exerciseId)?.kind === 'cardio' || (s.min !== undefined && s.kg === undefined)
          ? { min: num(s.min), km: num(s.km), done: true }
          : { kg: num(s.kg), reps: num(s.reps), done: true, ...(s.legacy ? { legacy: true } : {}) }
      ),
  })),
});

/** Apply the not-yet-sent changes on top of what the server returned */
function applyOutbox(history: Workout[], customs: CustomExercise[], outbox: Op[]) {
  let h = [...history];
  let c = [...customs];
  for (const op of outbox) {
    if (op.type === 'saveWorkout') h = [...h.filter(x => x.id !== op.payload.id), op.payload];
    if (op.type === 'deleteWorkout') h = h.filter(x => x.id !== op.payload.id);
    if (op.type === 'createExercise') c = [...c.filter(e => e.id !== op.payload.id), op.payload];
  }
  return { history: h, customs: c };
}

/** Read-only access for other pages (Floor suggestion, Mur session, scan prompt). */
export const JournalStore = {
  readHistory: async (userId: string): Promise<Workout[]> => {
    const [cache, outbox] = await Promise.all([readJson<Cache>(cacheKey(userId), { history: [], customs: [], syncedAt: null }), readJson<Op[]>(outboxKey(userId), [])]);
    return applyOutbox(cache.history, cache.customs, outbox).history;
  },
  hasDraft: async (userId: string) => !!(await readJson<Workout | null>(draftKey(userId), null)),
  /** Demo data: only on a brand-new journal, and kept local (never sent to the server). */
  seedIfEmpty: async (userId: string, workouts: Workout[]) => {
    const [cache, outbox, oldJournal] = await Promise.all([
      AsyncStorage.getItem(cacheKey(userId)),
      AsyncStorage.getItem(outboxKey(userId)),
      AsyncStorage.getItem(`@gym_app_journal_v1_${userId}`),
    ]);
    if (cache || outbox || oldJournal) return;
    await writeJson(cacheKey(userId), { history: workouts, customs: [], syncedAt: null });
  },
};

const isOnlineNow = () => (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : true);

/**
 * useJournalData({ userId, request })
 * returns { ready, history, customs, draft, saveDraft, saveWorkout, deleteWorkout, createExercise, sync }
 */
export function useJournalData({ userId, request = defaultJournalRequest }: { userId: string; request?: JournalRequest | null }) {
  const req = useRef(request);
  req.current = request;

  const [ready, setReady] = useState(false);
  const [outbox, setOutbox] = useState<Op[]>([]);
  const [base, setBase] = useState<{ history: Workout[]; customs: CustomExercise[] }>({ history: [], customs: [] });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [online, setOnline] = useState(isOnlineNow);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null);
  const flushing = useRef(false);
  const outboxRef = useRef<Op[]>([]);

  const setOut = (fn: (o: Op[]) => Op[]) => {
    const n = fn(outboxRef.current);
    outboxRef.current = n;
    writeJson(outboxKey(userId), n);
    setOutbox(n);
  };

  /* ---- get the latest from the server (only when nothing is waiting to be sent) ---- */
  const pull = useCallback(async () => {
    const call = req.current;
    if (!call) return;
    try {
      const [history, customs] = await Promise.all([call('GET', '/workouts?days=120'), call('GET', '/exercises/mine')]);
      if (outboxRef.current.length) return; // something was logged meanwhile: keep the local view
      const syncedAt = new Date().toISOString();
      writeJson(cacheKey(userId), { history, customs, syncedAt });
      setBase({ history, customs });
      setLastSync(syncedAt);
      setOnline(true);
    } catch (e) {
      if (!(e as { status?: number }).status) setOnline(false);
    }
  }, [userId]);

  /* ---- send pending changes, oldest first ---- */
  const flush = useCallback(async () => {
    const call = req.current;
    if (!call || flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    try {
      while (outboxRef.current.length) {
        const op = outboxRef.current[0];
        try {
          if (op.type === 'saveWorkout') await call('PUT', `/workouts/${op.payload.id}`, toServer(op.payload));
          if (op.type === 'deleteWorkout') await call('DELETE', `/workouts/${op.payload.id}`);
          if (op.type === 'createExercise') await call('PUT', `/exercises/mine/${op.payload.id}`, op.payload);
          setOut(o => o.filter(x => x.opId !== op.opId));
          setOnline(true);
        } catch (e) {
          const status = (e as { status?: number }).status;
          if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
            // the server refused this change for good (validation): drop it so the queue doesn't block
            console.warn('[journal] change refused by server', op, e);
            setOut(o => o.filter(x => x.opId !== op.opId));
          } else {
            if (!status) setOnline(false);
            setOut(o => o.map(x => (x.opId === op.opId ? { ...x, tries: (x.tries || 0) + 1 } : x)));
            break; // offline or server down: try again later
          }
        }
      }
      if (!outboxRef.current.length) await pull();
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [pull]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- load from the phone (and fold in the old journal once) ---- */
  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      const [cache, ob, d] = await Promise.all([
        readJson<Cache>(cacheKey(userId), { history: [], customs: [], syncedAt: null }),
        readJson<Op[]>(outboxKey(userId), []),
        readJson<Workout | null>(draftKey(userId), null),
      ]);
      const migrated = await migrateOldJournal(userId);
      const migOps: Op[] = [
        ...migrated.customs.map(p => ({ opId: newId(), type: 'createExercise' as const, payload: p, tries: 0 })),
        ...migrated.workouts.map(p => ({ opId: newId(), type: 'saveWorkout' as const, payload: p, tries: 0 })),
      ];
      if (!alive) return;
      outboxRef.current = [...ob, ...migOps];
      if (migOps.length) await writeJson(outboxKey(userId), outboxRef.current);
      await migrated.commit();
      if (!alive) return;
      setOutbox(outboxRef.current);
      setBase({ history: cache.history, customs: cache.customs });
      setLastSync(cache.syncedAt);
      setDraft(d);
      setCustomExercises(applyOutbox(cache.history, cache.customs, outboxRef.current).customs); // so the first sync knows own exercises
      setReady(true);
      if (outboxRef.current.length) flush();
      else pull();
    })();
    return () => {
      alive = false;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- retry when the network / app comes back ---- */
  useEffect(() => {
    const retry = () => (outboxRef.current.length ? flush() : pull());
    const app = AppState.addEventListener('change', s => s === 'active' && retry());
    let off = () => {};
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const on = () => {
        setOnline(true);
        flush();
      };
      const down = () => setOnline(false);
      window.addEventListener('online', on);
      window.addEventListener('offline', down);
      off = () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', down);
      };
    }
    const t = setInterval(() => outboxRef.current.length && flush(), 30_000);
    return () => {
      app.remove();
      off();
      clearInterval(t);
    };
  }, [flush, pull]);

  const enqueue = (op: Op) => {
    setOut(o => [...o, op]);
    setTimeout(flush, 0);
  };

  const { history, customs } = applyOutbox(base.history, base.customs, outbox);

  const sync: SyncInfo = {
    state: !req.current ? 'local' : !online ? 'offline' : outbox.length ? (syncing ? 'syncing' : 'pending') : 'synced',
    pending: outbox.length,
    lastSync,
    retry: () => {
      flush();
    },
  };

  return {
    ready,
    history,
    customs,
    draft,
    saveDraft: (d: Workout | null) => {
      setDraft(d);
      if (d) writeJson(draftKey(userId), d);
      else AsyncStorage.removeItem(draftKey(userId)).catch(() => {});
    },
    // all three resolve immediately: the change is safe on the phone even without network
    saveWorkout: async (wk: Workout) => enqueue({ opId: newId(), type: 'saveWorkout', payload: wk, tries: 0 }),
    deleteWorkout: async (id: string) => enqueue({ opId: newId(), type: 'deleteWorkout', payload: { id }, tries: 0 }),
    createExercise: async (ex: CustomExercise) => {
      enqueue({ opId: newId(), type: 'createExercise', payload: ex, tries: 0 });
      return { id: ex.id };
    },
    sync,
  };
}
