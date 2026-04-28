export interface UserProfile {
  id: string;
  email: string;
  normalizedEmail?: string;
  displayName: string;
  defaultTreeId?: string;
  createdAt: string;
}

function normaliseNameSource(value: string) {
  return value
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getUserDisplayLabel(user?: Pick<UserProfile, 'displayName' | 'email'> | null) {
  const displayName = normaliseNameSource(user?.displayName ?? '');
  if (displayName) {
    return displayName;
  }

  const emailLocalPart = normaliseNameSource(user?.email?.split('@')[0] ?? '');
  return emailLocalPart || 'You';
}

export function getUserNameParts(user?: Pick<UserProfile, 'displayName' | 'email'> | null) {
  const displayLabel = getUserDisplayLabel(user);
  const parts = displayLabel.split(' ').filter(Boolean);

  return {
    displayLabel,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

