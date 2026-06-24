import React from 'react';
import { Dimensions, Image, Modal, ScrollView, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import type { PersonRecord } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';

const styles = GlobalStyles.personProfile;

export function PersonPhotoViewerModal({
  person,
  viewerIndex,
  setViewerIndex,
}: {
  person: PersonRecord;
  viewerIndex: number | null;
  setViewerIndex: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const viewerWidth = Dimensions.get('window').width;
  const viewerHeight = Dimensions.get('window').height;

  return (
    <Modal visible={viewerIndex !== null} animationType="fade" transparent onRequestClose={() => setViewerIndex(null)}>
      <View style={styles.viewerBackdrop}>
        <IconButton icon="close" iconColor="#FFFFFF" size={28} style={styles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
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
          <ScrollView
            key={viewerIndex ?? 0}
            style={{ flex: 1 }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * viewerWidth, y: 0 }}
          >
            {person.photos.map((photo) => (
              <View key={`viewer-${photo.id}`} style={[styles.viewerSlide, { width: viewerWidth, height: viewerHeight }]}>
                <Image source={{ uri: photo.url }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
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
