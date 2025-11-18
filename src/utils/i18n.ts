import { en } from '../i18n/en.js';
import { zhCN } from '../i18n/zh-CN.js';

export type Language = 'en' | 'zh-CN';

let currentLanguage: Language = 'en';

const translations: Record<Language, Record<string, string>> = {
  'en': en,
  'zh-CN': zhCN,
};

/**
 * Set the current language
 */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

/**
 * Get the current language
 */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Translate a key with optional parameters
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const translation = translations[currentLanguage][key] || translations['en'][key] || key;
  
  if (!params) {
    return translation;
  }
  
  return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey]?.toString() || match;
  });
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number, lang: Language = currentLanguage): string {
  if (ms < 1000) {
    return lang === 'zh-CN' ? `${ms}毫秒` : `${ms}ms`;
  } else if (ms < 60000) {
    const seconds = (ms / 1000).toFixed(2);
    return lang === 'zh-CN' ? `${seconds}秒` : `${seconds}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return lang === 'zh-CN' ? `${minutes}分${seconds}秒` : `${minutes}m ${seconds}s`;
  }
}

/**
 * Format date to locale string
 */
export function formatDate(date: Date, lang: Language = currentLanguage): string {
  const locale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
  return date.toLocaleString(locale);
}
