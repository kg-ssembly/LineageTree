import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Card, Chip, Snackbar, Surface, Text } from 'react-native-paper';
import { PersonFormDialog } from '../components';
import { theme } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { PersonGender, PersonMutationPayload, PersonRecord } from '../types/person';
import type { RootStackParamList } from '../types/navigation';
import { canEditTreeContent } from '../types/tree';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonProfile'>;

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown person';
  }

  return `${person.firstName} ${person.lastName}`.trim();
}

function formatGender(gender: PersonGender) {
  if (gender === 'non-binary') {
    return 'Non-binary';
  }

  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

export default function PersonProfileScreen({ navigation, route }: Props) {
  const { user } = useAuthStore();
  const {
    trees,
    people,
    loadingTrees,
    loadingTreeData,
    mutating,
    error,
    selectTree,
    updatePerson,
    clearError,
  } = useTreeStore();

  const [editorVisible, setEditorVisible] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === route.params.treeId) ?? null,
    [route.params.treeId, trees],
  );

  const person = useMemo(
    () => people.find((currentPerson) => currentPerson.id === route.params.personId) ?? null,
    [people, route.params.personId],
  );

  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;

  useEffect(() => {
    selectTree(route.params.treeId);
  }, [route.params.treeId, selectTree]);

  useEffect(() => {
    if (person) {
      navigation.setOptions({ title: formatPersonName(person) });
    }
  }, [navigation, person]);

  useEffect(() => {
    if (!loadingTrees && !selectedTree) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [loadingTrees, navigation, selectedTree]);

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

  const handlePersonSubmit = async (payload: PersonMutationPayload) => {
    if (!user?.id || !person) {
      return;
    }

    try {
      await updatePerson(user.id, person, payload);
      setEditorVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  if (!selectedTree || !person || loadingTreeData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.heroCard} elevation={1}>
          <Text variant="headlineMedium">{formatPersonName(person)}</Text>
          <View style={styles.metadataRow}>
            {person.gender !== 'unspecified' ? <Chip compact>{formatGender(person.gender)}</Chip> : null}
            {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
            <Chip compact icon="image-multiple">{person.photos.length} photos</Chip>
          </View>
          {canEdit ? (
            <Button mode="contained-tonal" icon="pencil" onPress={() => setEditorVisible(true)} style={styles.editButton}>
              Edit profile
            </Button>
          ) : null}
        </Surface>

        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleLarge">Memories</Text>
          <Text variant="bodyMedium" style={styles.sectionSubtitle}>
            Notes and images stay attached to this person profile.
          </Text>

          <View style={styles.notesBox}>
            <Text variant="titleSmall">Notes</Text>
            <Text variant="bodyMedium" style={styles.notesText}>
              {person.notes || 'No notes added yet.'}
            </Text>
          </View>

          <View style={styles.gallerySection}>
            <Text variant="titleSmall">Photo gallery</Text>
            {person.photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                {person.photos.map((photo) => (
                  <Card key={photo.id} mode="outlined" style={styles.photoCard}>
                    <Image source={{ uri: photo.url }} style={styles.photo} />
                  </Card>
                ))}
              </ScrollView>
            ) : (
              <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                No photos in the gallery yet.
              </Text>
            )}
          </View>
        </Surface>
      </ScrollView>

      <PersonFormDialog
        visible={editorVisible}
        mode="edit"
        person={person}
        loading={mutating}
        onDismiss={() => setEditorVisible(false)}
        onSubmit={handlePersonSubmit}
      />

      <Snackbar
        visible={snackVisible}
        onDismiss={() => {
          setSnackVisible(false);
          clearError();
        }}
        duration={5000}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F7FF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  editButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  sectionCard: {
    borderRadius: 20,
    padding: 16,
  },
  sectionSubtitle: {
    marginTop: 6,
    color: '#6B6B74',
  },
  notesBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F3F0FF',
  },
  notesText: {
    marginTop: 8,
    color: '#4E4E58',
  },
  gallerySection: {
    marginTop: 20,
  },
  galleryRow: {
    paddingTop: 12,
    paddingRight: 12,
  },
  photoCard: {
    marginRight: 12,
    overflow: 'hidden',
    borderRadius: 18,
  },
  photo: {
    width: 220,
    height: 180,
    backgroundColor: '#ECE8FF',
  },
});

