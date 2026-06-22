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
  | 'nr';

export type TranslationMap = Record<string, string>;

export type LanguageOption = {
  code: AppLanguage;
  englishName: string;
  nativeName: string;
};
