import React, { useRef } from 'react';
import { recordMetric } from './performance-metrics';
import { Image as ExpoImage, type ImageContentFit, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

type CachedImageProps = {
  uri: string;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  priority?: 'low' | 'normal' | 'high';
  recyclingKey?: string;
  onError?: () => void;
};

export function CachedImage({
  uri,
  style,
  contentFit = 'cover',
  priority = 'normal',
  recyclingKey,
  onError,
}: CachedImageProps) {
  const started = useRef(0);
  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority={priority}
      recyclingKey={recyclingKey ?? uri}
      transition={0}
      onError={onError}
      onLoadStart={() => { started.current = performance.now(); }}
      onLoadEnd={() => { if (started.current) recordMetric('image.load.ms', performance.now() - started.current); }}
    />
  );
}

export default CachedImage;
