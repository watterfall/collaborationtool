// Public surface of the file-based i18n module.
export { zh } from './locales/zh';
export { en } from './locales/en';
export {
  parseAcceptLanguage,
  resolveLocale,
  getLocale,
  getDict,
  dictFor,
} from './get-locale';
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
  type LocaleDict,
} from './types';
