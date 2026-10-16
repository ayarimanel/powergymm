// Light (default) or dark colors. Screens build their styles once, when they load,
// so the choice is applied at launch (index.ts) and changing it restarts the app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, Platform } from 'react-native';
import clubTheme from './clubTheme';

export type ColorMode = 'light' | 'dark';
const KEY = '@gym_app_color_mode_v1';

/** Replaces the light colors by the dark ones. Call before src/theme.ts is loaded. */
export const applyColorMode = (mode: ColorMode) => {
  clubTheme.mode = mode;
  if (mode === 'dark') Object.assign(clubTheme.colors, clubTheme.darkMode);
};

export const loadColorMode = async (): Promise<ColorMode> => {
  const saved = await AsyncStorage.getItem(KEY).catch(() => null);
  const mode: ColorMode = saved === 'dark' ? 'dark' : 'light';
  applyColorMode(mode);
  return mode;
};

/** Saves the choice and restarts the app with it. Returns false when the app must be reopened by hand. */
export const saveColorMode = async (mode: ColorMode): Promise<boolean> => {
  await AsyncStorage.setItem(KEY, mode).catch(() => {});
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
    return true;
  }
  if (__DEV__) {
    DevSettings.reload();
    return true;
  }
  return false;
};
