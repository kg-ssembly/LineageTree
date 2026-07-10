import React, { useMemo } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { CachedImage } from '../../../../components';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = StyleSheet.create({
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 14, 0.94)',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 44,
    right: 16,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  viewerEditButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    zIndex: 2,
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  viewerNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  viewerNavButtonLeft: {
    left: 12,
  },
  viewerNavButtonRight: {
    right: 12,
  },
  viewerCounter: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  viewerInfoCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  viewerInfoLabel: {
    color: '#FFFFFF',
    opacity: 0.82,
  },
  viewerInfoValue: {
    marginTop: 2,
    marginBottom: 4,
    color: '#FFFFFF',
  },
  viewerSlide: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
});

export function PersonPhotoViewerModal({
  person,
  viewerIndex,
  setViewerIndex,
  onEditPhoto,
}: {
  person: PersonRecord;
  viewerIndex: number | null;
  setViewerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  onEditPhoto?: (photo: PersonPhoto) => void;
}) {
  const { t } = useI18n();
  const viewerWidth = Dimensions.get('window').width;
  const viewerHeight = Dimensions.get('window').height;
  const selectedPhoto = useMemo(
    () => (viewerIndex !== null ? person.photos[viewerIndex] ?? null : null),
    [person.photos, viewerIndex],
  );
  const initialViewerIndex = viewerIndex ?? 0;
  const linkedEventLabel = selectedPhoto?.linkedLifeEventId
    ? person.lifeEvents.find((event) => event.id === selectedPhoto.linkedLifeEventId)?.title ?? ''
    : '';

  return (
    <Modal visible={viewerIndex !== null} animationType="fade" transparent onRequestClose={() => setViewerIndex(null)}>
      <View style={styles.viewerBackdrop}>
        <IconButton icon="close" iconColor="#FFFFFF" size={28} style={styles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
        {selectedPhoto && onEditPhoto ? (
          <IconButton
            icon="pencil"
            iconColor="#FFFFFF"
            size={22}
            style={styles.viewerEditButton}
            onPress={() => {
              setViewerIndex(null);
              onEditPhoto(selectedPhoto);
            }}
            accessibilityLabel={t(K.common.edit)}
          />
        ) : null}
        {person.photos.length > 1 && viewerIndex !== null ? (
          <>
            <IconButton
              icon="chevron-left"
              iconColor="#FFFFFF"
              size={32}
              style={[styles.viewerNavButton, styles.viewerNavButtonLeft]}
              onPress={() => setViewerIndex((current) => current === null ? current : Math.max(0, current - 1))}
            />
            <IconButton
              icon="chevron-right"
              iconColor="#FFFFFF"
              size={32}
              style={[styles.viewerNavButton, styles.viewerNavButtonRight]}
              onPress={() => setViewerIndex((current) => current === null ? current : Math.min(person.photos.length - 1, current + 1))}
            />
          </>
        ) : null}
        {person.photos.length > 0 ? (
          <FlatList
            key={viewerIndex ?? 0}
            style={{ flex: 1 }}
            data={person.photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialViewerIndex}
            getItemLayout={(_, index) => ({
              length: viewerWidth,
              offset: viewerWidth * index,
              index,
            })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            renderItem={({ item }) => (
              <View key={`viewer-${item.id}`} style={[styles.viewerSlide, { width: viewerWidth, height: viewerHeight }]}>
                <CachedImage uri={item.url} style={styles.viewerImage} contentFit="contain" priority="high" recyclingKey={item.id} />
              </View>
            )}
          />
        ) : null}
        {selectedPhoto ? (
          <View style={styles.viewerInfoCard}>
            <Text variant="labelLarge" style={styles.viewerInfoLabel}>{t(K.memories.photoInfo)}</Text>
            <Text variant="bodySmall" style={styles.viewerInfoValue}>
              {t(K.memories.photoViewerSummary)}
            </Text>
            {selectedPhoto.description?.trim() ? (
              <Text variant="bodyMedium" style={styles.viewerInfoValue}>
                {selectedPhoto.description.trim()}
              </Text>
            ) : (
              <Text variant="bodyMedium" style={styles.viewerInfoValue}>
                {t(K.memories.noPhotoDescriptionYet)}
              </Text>
            )}
            {linkedEventLabel ? (
              <Text variant="bodyMedium" style={styles.viewerInfoValue}>
                {linkedEventLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
        {person.photos.length > 1 && viewerIndex !== null ? (
          <View style={styles.viewerCounter}>
            <Text variant="labelLarge" style={{ color: '#FFFFFF' }}>
              {viewerIndex + 1} / {person.photos.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
