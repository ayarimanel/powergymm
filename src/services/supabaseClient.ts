import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Scaffold for later: nothing in the app calls this yet, every screen still
 * reads/writes AsyncStorage directly. Once ready, migrate one service at a
 * time (checkInService first) to use this client instead, following the
 * schema in supabase/migrations/0001_initial_schema.sql.
 */
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const isSupabaseConfigured = !!supabase;
