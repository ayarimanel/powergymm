/**
 * Language: French or English.
 *
 * The French text is the key. `t('Rejoindre')` looks up an English translation
 * and, if there is none yet, returns the French unchanged. That means a screen
 * nobody has translated still reads correctly instead of showing a raw key, so
 * the app can be converted screen by screen without ever looking broken.
 *
 * The trade-off: changing a French wording changes its key, so the entry in
 * en.ts has to be updated with it. For two languages that is cheaper than
 * inventing and maintaining a key for all 576 strings.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EN } from './en';

export type Lang = 'fr' | 'en';

const KEY = '@gym_app_lang_v1';

/**
 * Mirrors the active language for code that is not a React component
 * (notification planners, services). Components use useT() so they re-render.
 */
let current: Lang = 'fr';

export const translate = (lang: Lang, fr: string, vars?: Record<string, string | number>): string => {
  const base = lang === 'en' ? (EN[fr] ?? fr) : fr;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
};

/** For services and anything outside the React tree. */
export const t = (fr: string, vars?: Record<string, string | number>) => translate(current, fr, vars);

export const getLang = (): Lang => current;

export const LANGUAGES: { id: Lang; label: string; native: string }[] = [
  { id: 'fr', label: 'Français', native: 'Français' },
  { id: 'en', label: 'English', native: 'English' },
];

/** null while we are still reading the stored choice: the picker waits for it. */
export const readStoredLang = async (): Promise<Lang | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === 'en' || raw === 'fr' ? raw : null;
  } catch {
    return null;
  }
};

const storeLang = (lang: Lang) => AsyncStorage.setItem(KEY, lang).catch(() => {});

interface Ctx {
  lang: Lang;
  /** null until the member has chosen (or we loaded their choice). */
  chosen: boolean;
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: (fr: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<Ctx>({
  lang: 'fr',
  chosen: false,
  ready: false,
  setLang: () => {},
  t: (fr: string) => fr,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('fr');
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readStoredLang().then(stored => {
      if (stored) {
        current = stored;
        setLangState(stored);
        setChosen(true);
      }
      setReady(true);
    });
  }, []);

  const setLang = (next: Lang) => {
    current = next;
    setLangState(next);
    setChosen(true);
    storeLang(next);
  };

  const value = useMemo<Ctx>(
    () => ({ lang, chosen, ready, setLang, t: (fr, vars) => translate(lang, fr, vars) }),
    [lang, chosen, ready]
  );

  return React.createElement(LanguageContext.Provider, { value }, children);
};

/** In a component: const { t } = useT(); then t('Rejoindre'). */
export const useT = () => useContext(LanguageContext);
