import { getDisplayPersonPhoto, type PersonRecord } from '../../../components/dto/person';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import type { SuggestionItem } from '../../../components';
import { I18N_KEYS as K } from '../../../i18n/keys';

type Translate = (key: string, params?: Record<string, string | number | null | undefined>) => string;
const MIN_TREE_MEMBERS_FOR_PROFILE_SUGGESTIONS = 10;

export function getPersonRelationshipCounts(personId: string, relationships: RelationshipRecord[]) {
  return relationships.reduce((acc, relationship) => {
    if (relationship.type === 'parent-child') {
      if (relationship.toPersonId === personId) {
        acc.parents += 1;
      }
      if (relationship.fromPersonId === personId) {
        acc.children += 1;
      }
      return acc;
    }

    if (relationship.fromPersonId === personId || relationship.toPersonId === personId) {
      acc.partners += 1;
    }

    return acc;
  }, { parents: 0, partners: 0, children: 0 });
}

export function getProfileCompletionChecks(person: PersonRecord, relationships: RelationshipRecord[]) {
  const counts = getPersonRelationshipCounts(person.id, relationships);
  return {
    counts,
    checks: [
      Boolean(person.birthDate),
      Boolean(person.birthPlace?.trim()),
      Boolean(person.notes?.trim()),
      person.photos.length > 0,
      counts.parents > 0,
      counts.partners > 0 || counts.children > 0,
    ],
  };
}

export function buildProfileSuggestions(
  person: PersonRecord,
  relationships: RelationshipRecord[],
  t: Translate,
): SuggestionItem[] {
  const relationshipCounts = getPersonRelationshipCounts(person.id, relationships);
  const suggestions: SuggestionItem[] = [];

  if (!person.birthDate) {
    suggestions.push({
      id: 'birth-date',
      title: t(K.personProfile.addBirthDateTitle),
      description: t(K.personProfile.addBirthDateBody),
      ctaLabel: t(K.personProfile.editProfile),
      actionTarget: { kind: 'edit-profile', personId: person.id },
      scope: 'profile',
      category: 'identity',
      icon: 'calendar-star',
      priority: 'urgent',
      score: 100,
    });
  }

  if (person.photos.length === 0) {
    suggestions.push({
      id: 'photos',
      title: t(K.personProfile.addPhotoTitle),
      description: t(K.personProfile.addPhotoBody),
      ctaLabel: t(K.memories.bringInPhotos),
      actionTarget: { kind: 'open-profile', personId: person.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' },
      scope: 'profile',
      category: 'memories',
      icon: 'image-plus',
      priority: 'easy-win',
      score: 90,
    });
  }

  if (!person.birthPlace?.trim()) {
    suggestions.push({
      id: 'places',
      title: t(K.personProfile.addPlaceTitle),
      description: t(K.personProfile.addPlaceBody),
      ctaLabel: t(K.personProfile.editProfile),
      actionTarget: { kind: 'edit-profile', personId: person.id },
      scope: 'profile',
      category: 'identity',
      icon: 'map-marker-plus',
      priority: 'recommended',
      score: 80,
    });
  }

  if (!person.notes?.trim()) {
    suggestions.push({
      id: 'story',
      title: t(K.personProfile.addStoryTitle),
      description: t(K.personProfile.addStoryBody),
      ctaLabel: t(K.memories.addNotes),
      actionTarget: { kind: 'open-profile', personId: person.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'notes' },
      scope: 'profile',
      category: 'memories',
      icon: 'notebook-plus',
      priority: 'recommended',
      score: 70,
    });
  }

  if (relationshipCounts.parents === 0 && !person.maidenName?.trim()) {
    suggestions.push({
      id: 'parents',
      title: t(K.personProfile.addParentsTitle),
      description: t(K.personProfile.addParentsBody),
      ctaLabel: t(K.personProfile.addRelationship),
      actionTarget: { kind: 'add-relationship', personId: person.id },
      scope: 'profile',
      category: 'relationships',
      icon: 'account-supervisor-outline',
      priority: 'urgent',
      score: 95,
    });
  }

  if (relationshipCounts.partners === 0 && relationshipCounts.children === 0) {
    suggestions.push({
      id: 'connections',
      title: t(K.personProfile.addRelationshipsTitle),
      description: t(K.personProfile.addRelationshipsBody),
      ctaLabel: t(K.personProfile.addRelationship),
      actionTarget: { kind: 'add-relationship', personId: person.id },
      scope: 'profile',
      category: 'relationships',
      icon: 'family-tree',
      priority: 'urgent',
      score: 85,
    });
  }

  return suggestions
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 4);
}

export function buildTreeSuggestions(
  input: {
    people: PersonRecord[];
    currentAssignedPerson: PersonRecord | null;
    currentSelfAssignmentSuggestionsCount: number;
    relationships: RelationshipRecord[];
    canEdit: boolean;
    showFollowUpTreePrompts: boolean;
  },
  t: Translate,
) {
  const {
    people,
    currentAssignedPerson,
    currentSelfAssignmentSuggestionsCount,
    relationships,
    canEdit,
    showFollowUpTreePrompts,
  } = input;
  const canSuggestProfileScope = people.length >= MIN_TREE_MEMBERS_FOR_PROFILE_SUGGESTIONS;

  if (!currentAssignedPerson) {
    const initialSuggestions: SuggestionItem[] = [];

    if (people.length < 2) {
      initialSuggestions.push({
        id: 'add-first-member',
        title: people.length === 0 ? t(K.home.addTheFirstFamilyMember) : t(K.home.addAnotherFamilyMember),
        description: people.length === 0
          ? t(K.home.startYourTreeWithTheFirstRelative)
          : t(K.home.startBuildingOutwardFromYourOwnPageByAddingTheNextPersonInTheFamily),
        ctaLabel: t(K.home.addFamilyMember),
        actionTarget: { kind: 'add-person' },
        scope: 'tree',
        category: 'tree',
        priority: 'urgent',
        score: people.length === 0 ? 1000 : 1200,
      });
    }

    if (canSuggestProfileScope) {
      initialSuggestions.push({
        id: 'link-self',
        title: t(K.home.createYourFamilyProfile),
        description: t(K.home.linkYourselfIntoTheTree),
        ctaLabel: t(K.home.startMyProfile),
        actionTarget: { kind: 'add-self' },
        scope: 'tree',
        category: 'growth',
        priority: 'urgent',
        score: people.length === 0 ? 1000 : 900,
      });
    }

    if (showFollowUpTreePrompts && people.length >= 2 && relationships.length === 0) {
      initialSuggestions.push({
        id: 'relationships',
        title: t(K.home.connectFamilyRelationships),
        description: t(K.home.parentsPartnersAndChildrenAreWhatTurnAProfileIntoABranch),
        ctaLabel: canEdit ? t(K.home.connectFamily) : t(K.home.viewProfile),
        actionTarget: canEdit ? { kind: 'open-relationship-dialog' } : { kind: 'add-self' },
        scope: 'tree',
        category: 'relationships',
        priority: 'urgent',
        score: 850,
      });
    }

    return {
      storySuggestions: initialSuggestions.filter((suggestion) => suggestion.category === 'growth'),
      treeSuggestions: initialSuggestions.filter((suggestion) => suggestion.category !== 'growth'),
    };
  }

  const relationshipCounts = getPersonRelationshipCounts(currentAssignedPerson.id, relationships);
  const hasPhoto = Boolean(getDisplayPersonPhoto(currentAssignedPerson));
  const hasBirthDetails = Boolean(currentAssignedPerson.birthDate?.trim());
  const hasStoryNote = Boolean(currentAssignedPerson.notes?.trim());
  const hasMemories = currentAssignedPerson.lifeEvents.length > 0;
  const hasRelationships = relationshipCounts.parents + relationshipCounts.partners + relationshipCounts.children > 0;
  const totalPeopleCount = people.length;
  const needsMorePeopleBeforeDetailPrompts = totalPeopleCount < 2;
  const needsRelationshipConnection = totalPeopleCount >= 2 && !hasRelationships;
  const hasCoreProfileFacts = hasBirthDetails && hasPhoto && hasRelationships;
  const otherPeopleCount = people.filter((person) => person.id !== currentAssignedPerson.id).length;

  const suggestions: SuggestionItem[] = [
    {
      id: 'review-matches',
      title: t(K.home.reviewPossibleProfileMatches),
      description: t(K.home.suggestedMatchesCanHelpYouQuicklyLinkTheRightPersonOrSpotLikelyOverlaps),
      ctaLabel: currentSelfAssignmentSuggestionsCount > 0 ? t(K.home.reviewMatches) : t(K.home.addMoreRelatives),
      actionTarget: currentSelfAssignmentSuggestionsCount > 0 ? { kind: 'add-self' } : { kind: 'add-person' },
      scope: 'tree',
      category: 'growth',
      priority: currentSelfAssignmentSuggestionsCount > 0 ? 'recommended' : 'easy-win',
      score: currentSelfAssignmentSuggestionsCount > 0 ? 320 : 180,
      done: currentSelfAssignmentSuggestionsCount === 0,
    },
  ];

  if (canSuggestProfileScope) {
    suggestions.unshift(
      {
        id: 'photo',
        title: t(K.home.addAProfilePhoto),
        description: t(K.home.aFaceMakesTheTreeFeelInstantlyMoreHumanAndRecognizable),
        ctaLabel: t(K.home.addPortrait),
        actionTarget: { kind: 'open-profile', personId: currentAssignedPerson.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' },
        scope: 'tree',
        category: 'memories',
        priority: 'easy-win',
        score: needsMorePeopleBeforeDetailPrompts || needsRelationshipConnection ? 40 : hasBirthDetails ? 220 : 180,
        done: hasPhoto,
      },
      {
        id: 'birth',
        title: t(K.home.fillInBirthDetails),
        description: t(K.home.datesAnchorTheStoryAndHelpPlaceEachGenerationCorrectly),
        ctaLabel: t(K.home.addBirthDetails),
        actionTarget: { kind: 'edit-profile', personId: currentAssignedPerson.id },
        scope: 'tree',
        category: 'identity',
        priority: 'urgent',
        score: needsMorePeopleBeforeDetailPrompts || needsRelationshipConnection ? 120 : 700,
        done: hasBirthDetails,
      },
      {
        id: 'memory',
        title: t(K.home.recordAMilestone),
        description: t(K.home.addOneLifeEventSoTheTimelineStartsFeelingLikeALivingScrapbook),
        ctaLabel: t(K.home.addMemory),
        actionTarget: { kind: 'open-profile', personId: currentAssignedPerson.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'events' },
        scope: 'tree',
        category: 'memories',
        priority: 'recommended',
        score: needsMorePeopleBeforeDetailPrompts || needsRelationshipConnection ? 30 : hasRelationships || hasPhoto ? 160 : 120,
        done: hasMemories,
      },
    );
  }

  if (totalPeopleCount >= 2) {
    if (canEdit && relationshipCounts.parents === 0) {
      suggestions.push({
        id: 'add-parent',
        title: t(K.relationship.parentOfName, { name: currentAssignedPerson.firstName }),
        description: t(K.relationship.createParentForName, { name: currentAssignedPerson.firstName }),
        ctaLabel: t(K.home.addFamilyMember),
        actionTarget: { kind: 'add-relative', personId: currentAssignedPerson.id, mode: 'parent-of' },
        scope: 'tree',
        category: 'relationships',
        priority: 'urgent',
        score: 1100,
      });
    }

    if (canEdit && relationshipCounts.children === 0) {
      suggestions.push({
        id: 'add-child',
        title: t(K.relationship.childOfName, { name: currentAssignedPerson.firstName }),
        description: t(K.relationship.createChildForName, { name: currentAssignedPerson.firstName }),
        ctaLabel: t(K.home.addFamilyMember),
        actionTarget: { kind: 'add-relative', personId: currentAssignedPerson.id, mode: 'child-of' },
        scope: 'tree',
        category: 'relationships',
        priority: 'urgent',
        score: 1080,
      });
    }

    if (canEdit && relationshipCounts.partners === 0) {
      suggestions.push({
        id: 'add-spouse',
        title: t(K.relationship.spouseOfName, { name: currentAssignedPerson.firstName }),
        description: t(K.relationship.createSpouseForName, { name: currentAssignedPerson.firstName }),
        ctaLabel: t(K.home.addFamilyMember),
        actionTarget: { kind: 'add-relative', personId: currentAssignedPerson.id, mode: 'spouse-of' },
        scope: 'tree',
        category: 'relationships',
        priority: 'urgent',
        score: 1060,
      });
    }

    suggestions.push({
      id: 'relationships',
      title: t(K.home.connectFamilyRelationships),
      description: t(K.home.parentsPartnersAndChildrenAreWhatTurnAProfileIntoABranch),
      ctaLabel: canEdit ? t(K.home.connectFamily) : t(K.home.viewProfile),
      actionTarget: canEdit ? { kind: 'open-relationship-dialog' } : { kind: 'open-profile', personId: currentAssignedPerson.id },
      scope: 'tree',
      category: 'relationships',
      priority: 'urgent',
      score: needsRelationshipConnection ? 1000 : 760,
      done: hasRelationships,
    });
  }

  if (showFollowUpTreePrompts || otherPeopleCount === 0) {
    suggestions.push({
      id: 'add-family-member',
      title: otherPeopleCount > 0 ? t(K.home.addAnotherFamilyMember) : t(K.home.addTheFirstFamilyMember),
      description: otherPeopleCount > 0
        ? t(K.home.eachNewRelativeGivesTheTreeMoreShapeAndMakesFamilyConnectionsEasierToDiscover)
        : t(K.home.startBuildingOutwardFromYourOwnPageByAddingTheNextPersonInTheFamily),
      ctaLabel: t(K.home.addFamilyMember),
      actionTarget: { kind: 'add-person' },
      scope: 'tree',
      category: 'tree',
      priority: 'urgent',
      score: otherPeopleCount > 0 ? 950 : 1200,
      done: otherPeopleCount > 0,
    });
  }

  if (canSuggestProfileScope && hasCoreProfileFacts) {
    suggestions.push({
      id: 'story',
      title: t(K.home.writeAStoryNote),
      description: t(K.home.aSmallMemoryOrDescriptionBringsTheProfileToLife),
      ctaLabel: t(K.home.writeNote),
      actionTarget: { kind: 'open-profile', personId: currentAssignedPerson.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'notes' },
      scope: 'tree',
      category: 'memories',
      priority: 'recommended',
      score: hasMemories ? 90 : 70,
      done: hasStoryNote,
    });
  }

  const sorted = suggestions.sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.title.localeCompare(right.title));
  return {
    storySuggestions: sorted.filter((suggestion) => suggestion.category !== 'tree' && suggestion.category !== 'relationships'),
    treeSuggestions: sorted.filter((suggestion) => suggestion.category === 'tree' || suggestion.category === 'relationships'),
  };
}

export function buildMissingDetailSuggestionForPerson(
  person: PersonRecord,
  relationships: RelationshipRecord[],
  t: Translate,
): SuggestionItem | null {
  let score = 0;
  const issues: string[] = [];
  const relationshipCount = relationships.filter((relationship) => (
    relationship.fromPersonId === person.id || relationship.toPersonId === person.id
  )).length;

  let actionTarget: SuggestionItem['actionTarget'] = { kind: 'open-profile', personId: person.id };

  if (!person.birthDate?.trim()) {
    score += 3;
    issues.push(t(K.home.missingBirthDate));
    actionTarget = { kind: 'edit-profile', personId: person.id };
  } else if (!getDisplayPersonPhoto(person)) {
    score += 2;
    issues.push(t(K.home.missingProfilePhoto));
    actionTarget = { kind: 'open-profile', personId: person.id, initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' };
  } else if (relationshipCount === 0) {
    score += 3;
    issues.push(t(K.home.missingFamilyConnections));
    actionTarget = { kind: 'open-profile', personId: person.id, initialTab: 'relationships' };
  }

  if (score === 0) {
    return null;
  }

  return {
    id: `missing:${person.id}`,
    title: person.firstName,
    description: issues.join(' · '),
    ctaLabel: t(K.home.reviewMemberDetails),
    actionTarget,
    scope: 'tree',
    category: 'growth',
    score,
  };
}
