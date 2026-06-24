import React from 'react';
import { Dimensions, Image, Modal, ScrollView, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import type { PersonRecord } from '../../../../components/dto/person';
import { GlobalStyles } from '../../../../constants/styles';

const personProfileStyles = GlobalStyles.personProfile;

export function PhotoViewerModal({
  linkedPerson,
  viewerIndex,
  setViewerIndex,
}: {
  linkedPerson: PersonRecord | null;
  viewerIndex: number | null;
  setViewerIndex: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const viewerWidth = Dimensions.get('window').width;
  const viewerHeight = Dimensions.get('window').height;

  return (
    <Modal visible={viewerIndex !== null} animationType="fade" transparent onRequestClose={() => setViewerIndex(null)}>
      <View style={personProfileStyles.viewerBackdrop}>
        <IconButton icon="close" iconColor="#FFFFFF" size={28} style={personProfileStyles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
        {linkedPerson && linkedPerson.photos.length > 1 && viewerIndex !== null ? (
          <>
            <IconButton
              icon="chevron-left"
              iconColor="#FFFFFF"
              size={32}
              style={[personProfileStyles.viewerNavButton, personProfileStyles.viewerNavButtonLeft]}
              onPress={() => setViewerIndex((current) => current === null ? current : Math.max(0, current - 1))}
            />
            <IconButton
              icon="chevron-right"
              iconColor="#FFFFFF"
              size={32}
              style={[personProfileStyles.viewerNavButton, personProfileStyles.viewerNavButtonRight]}
              onPress={() => setViewerIndex((current) => current === null ? current : Math.min(linkedPerson.photos.length - 1, current + 1))}
            />
          </>
        ) : null}
        {linkedPerson && linkedPerson.photos.length > 0 ? (
          <ScrollView
            key={viewerIndex ?? 0}
            style={{ flex: 1 }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * viewerWidth, y: 0 }}
          >
            {linkedPerson.photos.map((photo) => (
              <View key={`viewer-${photo.id}`} style={[personProfileStyles.viewerSlide, { width: viewerWidth, height: viewerHeight }]}>
                <Image source={{ uri: photo.url }} style={personProfileStyles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        ) : null}
        {linkedPerson && linkedPerson.photos.length > 1 && viewerIndex !== null ? (
          <View style={personProfileStyles.viewerCounter}>
            <Text variant="labelLarge" style={{ color: '#FFFFFF' }}>
              {viewerIndex + 1} / {linkedPerson.photos.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
