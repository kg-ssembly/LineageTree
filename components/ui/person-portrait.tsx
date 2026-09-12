import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import CachedImage from '../cached-image';
import { getDisplayPersonPhoto, type PersonRecord } from '../dto/person';

/** One portrait treatment for tree cards and person previews. */
export function PersonPortrait({ person, size = 84, highlighted = false, deferPhoto = false }: {
  person: PersonRecord;
  size?: number;
  highlighted?: boolean;
  deferPhoto?: boolean;
}) {
  const theme = useTheme();
  const photo = getDisplayPersonPhoto(person);
  const [failedUrl, setFailedUrl] = useState<string>();
  const initials = [person.firstName, person.lastName].map(part => Array.from(part.trim())[0] ?? '').join('').toLocaleUpperCase() || '?';
  const borderColor = highlighted ? theme.colors.primary : theme.colors.outlineVariant;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: highlighted ? 3 : 2, borderColor, padding: 3, backgroundColor: theme.colors.surface, flexShrink: 0 }}>
      <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden', backgroundColor: theme.colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant={size > 100 ? 'headlineLarge' : 'titleLarge'} style={{ color: theme.colors.onPrimaryContainer }} accessible={false}>{initials}</Text>
        {photo && !deferPhoto && failedUrl !== photo.url ? (
          <CachedImage uri={photo.url} style={{ position: 'absolute', width: '100%', height: '100%' }} priority={size > 100 ? 'high' : 'low'} recyclingKey={photo.id} onError={() => setFailedUrl(photo.url)} />
        ) : null}
      </View>
    </View>
  );
}
