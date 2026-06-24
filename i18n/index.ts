import af from './locales/af';
import en from './locales/en';
import nr from './locales/nr';
import nso from './locales/nso';
import ss from './locales/ss';
import st from './locales/st';
import tn from './locales/tn';
import ts from './locales/ts';
import ve from './locales/ve';
import xh from './locales/xh';
import zu from './locales/zu';
import { TRANSLATION_FALLBACKS } from './keys';
import type { AppLanguage, LanguageOption, TranslationMap } from './types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'af', englishName: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'zu', englishName: 'isiZulu', nativeName: 'isiZulu' },
  { code: 'xh', englishName: 'isiXhosa', nativeName: 'isiXhosa' },
  { code: 'nso', englishName: 'Sepedi', nativeName: 'Sepedi' },
  { code: 'st', englishName: 'Sesotho', nativeName: 'Sesotho' },
  { code: 'tn', englishName: 'Setswana', nativeName: 'Setswana' },
  { code: 'ts', englishName: 'Xitsonga', nativeName: 'Xitsonga' },
  { code: 'ss', englishName: 'siSwati', nativeName: 'siSwati' },
  { code: 've', englishName: 'Tshivenda', nativeName: 'Tshivenda' },
  { code: 'nr', englishName: 'isiNdebele', nativeName: 'isiNdebele' },
];

const TRANSLATIONS: Record<AppLanguage, TranslationMap> = {
  en,
  af,
  zu,
  xh,
  nso,
  st,
  tn,
  ts,
  ss,
  ve,
  nr,
};

let activeLanguage: AppLanguage = 'en';

export function setActiveLanguage(language: AppLanguage) {
  activeLanguage = language;
}

export function getActiveLanguage() {
  return activeLanguage;
}

export function translate(message: string, params?: Record<string, string | number | null | undefined>) {
  const fallback = TRANSLATION_FALLBACKS[message] ?? message;
  const localized = TRANSLATIONS[activeLanguage]?.[message]
    ?? TRANSLATIONS[activeLanguage]?.[fallback]
    ?? fallback;

  if (!params) {
    return localized;
  }

  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, `${value ?? ''}`);
  }, localized);
}

export type { AppLanguage, LanguageOption } from './types';
export { I18N_KEYS, type TranslationKey } from './keys';
