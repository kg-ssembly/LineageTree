import type { TranslationKey } from './keys';

export type AppLanguage =
  | 'en'
  | 'af'
  | 'zu'
  | 'xh'
  | 'nso'
  | 'st'
  | 'tn'
  | 'ts'
  | 'ss'
  | 've'
  | 'nr'
  | 'it'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt';

export type TranslationMap = Partial<Record<TranslationKey, string>>;

export type LanguageOption = {
  code: AppLanguage;
  englishName: string;
  nativeName: string;
};
