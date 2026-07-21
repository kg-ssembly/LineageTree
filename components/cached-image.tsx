import React from 'react';
import { Image as ExpoImage, type ImageContentFit, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

type CachedImageProps = {
  uri: string;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  priority?: 'low' | 'normal' | 'high';
  recyclingKey?: string;
};

export function CachedImage({
  uri,
  style,
  contentFit = 'cover',
  priority = 'normal',
  recyclingKey,
}: CachedImageProps) {
  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={recyclingKey ?? uri}
      transition={0}
    />
  );
}

export default CachedImage;
