import { I18N_KEYS as K } from '../../../../i18n/keys';

export function validateEmail(email: string, t: (message: string) => string): string | null {
  if (!email.trim()) {
    return t('Email is required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return t(K.auth.enterValidEmail);
  }

  return null;
}

export function validateLoginPassword(password: string, t: (message: string) => string): string | null {
  if (!password) {
    return t(K.auth.passwordRequired);
  }

  return null;
}

export function validateSignUpPassword(password: string, t: (message: string) => string): string | null {
  if (!password) {
    return t(K.auth.passwordRequired);
  }

  if (password.length < 8) {
    return t('Use at least 8 characters.');
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return t('Use uppercase, lowercase, and a number.');
  }

  return null;
}

export function validateDisplayName(name: string, t: (message: string) => string): string | null {
  if (!name.trim()) {
    return t('Name is required.');
  }

  if (name.trim().length < 2) {
    return t('Name must be at least 2 characters.');
  }

  return null;
}
