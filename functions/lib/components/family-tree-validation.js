"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonValidationFeedback = getPersonValidationFeedback;
exports.normalizeRelationshipEndpoints = normalizeRelationshipEndpoints;
exports.findDuplicateRelationship = findDuplicateRelationship;
exports.validateProposedRelationship = validateProposedRelationship;
exports.getRelationshipValidationFeedback = getRelationshipValidationFeedback;
exports.getRelationshipValidationResolution = getRelationshipValidationResolution;
const person_date_1 = require("./person-date");
const person_1 = require("./dto/person");
const photo_constants_1 = require("./photo-constants");
const i18n_1 = require("../i18n");
const keys_1 = require("../i18n/keys");
const MIN_BIOLOGICAL_PARENT_AGE = 12;
function normaliseNamePart(value) {
    return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}
function formatDateToIso(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getFirstToken(value) {
    return normaliseNamePart(value).split(' ').filter(Boolean)[0] ?? '';
}
const NICKNAME_GROUPS = [
    ['john', 'jon', 'johnny', 'jonny', 'jonathan'],
    ['katherine', 'catherine', 'kathryn', 'kathy', 'katie', 'kate', 'kat'],
    ['margaret', 'maggie', 'meg', 'megan', 'peggy', 'rita'],
    ['elizabeth', 'liz', 'beth', 'lizzy', 'eliza', 'betsy'],
    ['william', 'bill', 'billy', 'will', 'willy', 'liam'],
    ['robert', 'rob', 'robbie', 'bob', 'bobby'],
    ['james', 'jim', 'jimmy', 'jamie'],
    ['joseph', 'joe', 'joey'],
    ['daniel', 'dan', 'danny'],
    ['michael', 'mike', 'mikey'],
    ['andrew', 'andy', 'drew'],
    ['anthony', 'tony'],
    ['nicholas', 'nick', 'nicky'],
    ['steven', 'stephen', 'steve'],
    ['sarah', 'sara'],
    ['rebecca', 'rebekah', 'becky', 'becca'],
    ['christopher', 'chris'],
];
function canonicalGivenName(value) {
    const token = getFirstToken(value);
    if (!token) {
        return '';
    }
    const matchedGroup = NICKNAME_GROUPS.find((group) => group.includes(token));
    return matchedGroup?.[0] ?? token;
}
function getEditDistance(left, right) {
    if (left === right) {
        return 0;
    }
    if (!left.length) {
        return right.length;
    }
    if (!right.length) {
        return left.length;
    }
    const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
    for (let column = 1; column <= right.length; column += 1) {
        let previous = rows[0];
        rows[0] = column;
        for (let row = 1; row <= left.length; row += 1) {
            const current = rows[row];
            const cost = left[row - 1] === right[column - 1] ? 0 : 1;
            rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, previous + cost);
            previous = current;
        }
    }
    return rows[left.length];
}
function isNearDuplicateGivenName(left, right) {
    const canonicalLeft = canonicalGivenName(left);
    const canonicalRight = canonicalGivenName(right);
    if (!canonicalLeft || !canonicalRight) {
        return false;
    }
    if (canonicalLeft === canonicalRight) {
        return true;
    }
    const maxLength = Math.max(canonicalLeft.length, canonicalRight.length);
    if (maxLength < 4) {
        return false;
    }
    return getEditDistance(canonicalLeft, canonicalRight) <= 1;
}
function getAgeDifferenceInYears(olderDateValue, youngerDateValue) {
    const olderDate = (0, person_1.parsePersonDate)(olderDateValue);
    const youngerDate = (0, person_1.parsePersonDate)(youngerDateValue);
    if (!olderDate || !youngerDate) {
        return null;
    }
    let years = youngerDate.getFullYear() - olderDate.getFullYear();
    const monthDelta = youngerDate.getMonth() - olderDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && youngerDate.getDate() < olderDate.getDate())) {
        years -= 1;
    }
    return years;
}
function isNonBiologicalParentChildKind(kind) {
    return kind === 'non-biological' || kind === 'step' || kind === 'adopted' || kind === 'foster' || kind === 'guardian';
}
function isBiologicalParentChildKind(kind) {
    return !kind || kind === 'biological';
}
function isCurrentSpouseStatus(status) {
    return !status || status === 'partner' || status === 'married';
}
function normalisePhotoValue(value) {
    return value?.trim().toLowerCase() ?? '';
}
function getRelationshipPeerId(relationship, personId) {
    if (relationship.fromPersonId === personId) {
        return relationship.toPersonId;
    }
    if (relationship.toPersonId === personId) {
        return relationship.fromPersonId;
    }
    return null;
}
function getRelationshipSignature(relationships) {
    return relationships
        .filter((relationship) => relationship.relatedPersonId)
        .map((relationship) => `${relationship.mode}:${relationship.relatedPersonId}`)
        .sort()
        .join('|');
}
function hasMultipleBirthHint(person) {
    const notes = normaliseNamePart(person.notes);
    return notes.includes('twin') || notes.includes('triplet') || notes.includes('multiple birth');
}
function diffDays(leftDateValue, rightDateValue) {
    const left = (0, person_1.parsePersonDate)(leftDateValue);
    const right = (0, person_1.parsePersonDate)(rightDateValue);
    if (!left || !right) {
        return null;
    }
    const milliseconds = Math.abs(left.getTime() - right.getTime());
    return Math.round(milliseconds / (1000 * 60 * 60 * 24));
}
function getBiologicalParentIdsForChild(relationships, childId, ignoreRelationshipId) {
    return relationships
        .filter((relationship) => relationship.id !== ignoreRelationshipId)
        .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === childId)
        .filter((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
        .map((relationship) => relationship.fromPersonId);
}
function getPersonValidationFeedback({ people, relationships = [], person, pendingRelationships = [], existingPhotos = [], removedPhotos = [], newPhotoUris = [], requireIdentityContext = false, requireRelationshipContext = false, ignorePersonId, }) {
    const errors = [];
    const warnings = [];
    const firstName = normaliseNamePart(person.firstName);
    const middleNames = normaliseNamePart(person.middleNames);
    const lastName = normaliseNamePart(person.lastName);
    const birthDate = person.birthDate.trim();
    const deathDate = person.deathDate.trim();
    if (!firstName) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.firstNameRequiredError));
    }
    if (!lastName) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.lastNameRequired));
    }
    if (birthDate && !(0, person_date_1.personDateBounds)(birthDate))
        errors.push('Enter a valid birth date, year, or approximate year (~1940).');
    if (deathDate && !(0, person_date_1.personDateBounds)(deathDate))
        errors.push('Enter a valid death date, year, or approximate year (~1940).');
    if (requireIdentityContext && !lastName && !birthDate && pendingRelationships.filter((relationship) => relationship.relatedPersonId).length === 0) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.identityDetailRequired));
    }
    if (requireRelationshipContext && pendingRelationships.filter((relationship) => relationship.relatedPersonId).length === 0) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.addRelationshipToConnectMember));
    }
    if (birthDate && (0, person_date_1.isDefinitelyBefore)(formatDateToIso(new Date()), birthDate)) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.birthDateInFuture));
    }
    if (deathDate && (0, person_date_1.isDefinitelyBefore)(formatDateToIso(new Date()), deathDate)) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.deathDateInFuture));
    }
    if (birthDate && deathDate && (0, person_date_1.isDefinitelyBefore)(deathDate, birthDate)) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.deathDateBeforeBirth));
    }
    person.lifeEvents.forEach((event) => {
        if (birthDate && (0, person_date_1.isDefinitelyBefore)(event.date, birthDate)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.lifeEventBeforeBirth));
        }
        if (deathDate && (0, person_date_1.isDefinitelyBefore)(deathDate, event.date)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.lifeEventAfterDeath));
            if (event.type !== 'death') {
                warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.deceasedPersonHasPresentDayEvents));
            }
        }
    });
    const matches = people.filter((candidate) => {
        if (candidate.id === ignorePersonId) {
            return false;
        }
        return normaliseNamePart(candidate.firstName) === firstName
            && normaliseNamePart(candidate.middleNames) === middleNames
            && normaliseNamePart(candidate.lastName) === lastName;
    });
    const exactDuplicate = matches.find((candidate) => {
        const sameBirth = birthDate && candidate.birthDate === birthDate;
        const sameDeath = deathDate && candidate.deathDate === deathDate;
        return sameBirth || sameDeath;
    });
    if (exactDuplicate) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.duplicateNameAndDate));
    }
    else if (matches.length > 0) {
        warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.duplicateNameWarning));
    }
    const nearDuplicate = people.find((candidate) => {
        if (candidate.id === ignorePersonId) {
            return false;
        }
        const sameLastName = normaliseNamePart(candidate.lastName) === lastName && Boolean(lastName);
        if (!sameLastName) {
            return false;
        }
        const directNearMatch = isNearDuplicateGivenName(person.firstName, candidate.firstName);
        const swappedMatch = normaliseNamePart(person.firstName) === getFirstToken(candidate.middleNames)
            && getFirstToken(person.middleNames) === normaliseNamePart(candidate.firstName);
        return directNearMatch || swappedMatch;
    });
    if (nearDuplicate) {
        warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.nearDuplicateNameWarning));
    }
    const activeExistingPhotos = existingPhotos.filter((photo) => !removedPhotos.some((removedPhoto) => removedPhoto.id === photo.id));
    const seenPhotoKeys = new Set();
    const duplicateNewPhoto = newPhotoUris.find((uri) => {
        const key = normalisePhotoValue(uri);
        if (!key) {
            return false;
        }
        if (seenPhotoKeys.has(key)) {
            return true;
        }
        seenPhotoKeys.add(key);
        return false;
    });
    const duplicateAgainstExisting = activeExistingPhotos.find((photo) => {
        const urlKey = normalisePhotoValue(photo.url);
        const pathKey = normalisePhotoValue(photo.path);
        return newPhotoUris.some((uri) => {
            const uriKey = normalisePhotoValue(uri);
            return uriKey && (uriKey === urlKey || uriKey === pathKey);
        });
    });
    if (duplicateNewPhoto || duplicateAgainstExisting) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.duplicatePhotosBeforeSaving));
    }
    if (activeExistingPhotos.length + newPhotoUris.length > photo_constants_1.MAX_PHOTOS_PER_PERSON) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.media.photoLimitSummary));
    }
    const exactRelationshipSignature = getRelationshipSignature(pendingRelationships);
    if (exactRelationshipSignature) {
        const duplicateImportedPerson = matches.find((candidate) => {
            const existingSignature = getRelationshipSignature(relationships
                .filter((relationship) => relationship.fromPersonId === candidate.id || relationship.toPersonId === candidate.id)
                .map((relationship) => {
                if (relationship.type === 'spouse') {
                    return {
                        mode: 'spouse-of',
                        relatedPersonId: getRelationshipPeerId(relationship, candidate.id) ?? '',
                    };
                }
                return relationship.fromPersonId === candidate.id
                    ? { mode: 'parent-of', relatedPersonId: relationship.toPersonId }
                    : { mode: 'child-of', relatedPersonId: relationship.fromPersonId };
            }));
            return existingSignature === exactRelationshipSignature;
        });
        if (duplicateImportedPerson) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.duplicateImportedPerson));
        }
    }
    if (!lastName && person.maidenName?.trim()) {
        warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.personForm.maidenNameWithoutSurname));
    }
    return { errors, warnings };
}
function normalizeRelationshipEndpoints(type, fromPersonId, toPersonId) {
    if (type !== 'spouse') {
        return { fromPersonId, toPersonId };
    }
    const [firstId, secondId] = [fromPersonId, toPersonId].sort();
    return { fromPersonId: firstId, toPersonId: secondId };
}
function findDuplicateRelationship(relationships, type, fromPersonId, toPersonId, ignoreRelationshipId) {
    const normalized = normalizeRelationshipEndpoints(type, fromPersonId, toPersonId);
    return relationships.some((relationship) => {
        if (relationship.id === ignoreRelationshipId) {
            return false;
        }
        if (relationship.type !== type) {
            return false;
        }
        const current = normalizeRelationshipEndpoints(relationship.type, relationship.fromPersonId, relationship.toPersonId);
        return current.fromPersonId === normalized.fromPersonId
            && current.toPersonId === normalized.toPersonId;
    });
}
function buildsCircularAncestry(relationships, parentId, childId, ignoreRelationshipId) {
    const childrenByParentId = new Map();
    relationships.forEach((relationship) => {
        if (relationship.id === ignoreRelationshipId || relationship.type !== 'parent-child') {
            return;
        }
        if (!childrenByParentId.has(relationship.fromPersonId)) {
            childrenByParentId.set(relationship.fromPersonId, new Set());
        }
        childrenByParentId.get(relationship.fromPersonId).add(relationship.toPersonId);
    });
    const stack = [childId];
    const visited = new Set();
    while (stack.length > 0) {
        const currentId = stack.pop();
        if (currentId === parentId) {
            return true;
        }
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        (childrenByParentId.get(currentId) ?? new Set()).forEach((nextId) => {
            if (!visited.has(nextId)) {
                stack.push(nextId);
            }
        });
    }
    return false;
}
function buildParentChildIndex(relationships, ignoreRelationshipId) {
    const childrenByParentId = new Map();
    const parentIdsByChildId = new Map();
    relationships.forEach((relationship) => {
        if (relationship.id === ignoreRelationshipId || relationship.type !== 'parent-child') {
            return;
        }
        if (!childrenByParentId.has(relationship.fromPersonId)) {
            childrenByParentId.set(relationship.fromPersonId, new Set());
        }
        childrenByParentId.get(relationship.fromPersonId).add(relationship.toPersonId);
        if (!parentIdsByChildId.has(relationship.toPersonId)) {
            parentIdsByChildId.set(relationship.toPersonId, new Set());
        }
        parentIdsByChildId.get(relationship.toPersonId).add(relationship.fromPersonId);
    });
    return { childrenByParentId, parentIdsByChildId };
}
function isAncestorOf(childrenByParentId, ancestorId, descendantId) {
    const stack = [...(childrenByParentId.get(ancestorId) ?? new Set())];
    const visited = new Set();
    while (stack.length > 0) {
        const currentId = stack.pop();
        if (currentId === descendantId) {
            return true;
        }
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        (childrenByParentId.get(currentId) ?? new Set()).forEach((nextId) => {
            if (!visited.has(nextId)) {
                stack.push(nextId);
            }
        });
    }
    return false;
}
function sharesParent(parentIdsByChildId, personAId, personBId) {
    const personAParents = parentIdsByChildId.get(personAId) ?? new Set();
    return [...(parentIdsByChildId.get(personBId) ?? new Set())].some((parentId) => personAParents.has(parentId));
}
function validateProposedRelationship({ people, relationships, type, fromPersonId, toPersonId, parentChildKind, relationshipStatus, ignoreRelationshipId, }) {
    return getRelationshipValidationFeedback({
        people,
        relationships,
        type,
        fromPersonId,
        toPersonId,
        parentChildKind,
        relationshipStatus,
        ignoreRelationshipId,
    }).errors[0] ?? null;
}
function getRelationshipValidationFeedback({ people, relationships, type, fromPersonId, toPersonId, parentChildKind, relationshipStatus, ignoreRelationshipId, }) {
    const errors = [];
    const warnings = [];
    if (!fromPersonId || !toPersonId) {
        return { errors, warnings };
    }
    if (fromPersonId === toPersonId) {
        errors.push(type === 'spouse'
            ? (0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.cannotBeOwnSpouse)
            : (0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.cannotBeOwnParentOrChild));
        return { errors, warnings };
    }
    if (people && people.length > 0) {
        const peopleById = new Map(people.map((person) => [person.id, person]));
        if (!peopleById.has(fromPersonId) || !peopleById.has(toPersonId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.peopleMustBeValid));
            return { errors, warnings };
        }
        if (type === 'parent-child') {
            const parent = peopleById.get(fromPersonId);
            const child = peopleById.get(toPersonId);
            const biologicalParentIds = getBiologicalParentIdsForChild(relationships, toPersonId, ignoreRelationshipId);
            const nextBiologicalParentIds = isBiologicalParentChildKind(parentChildKind)
                ? [...new Set([...biologicalParentIds, fromPersonId])]
                : biologicalParentIds;
            if (isBiologicalParentChildKind(parentChildKind) && nextBiologicalParentIds.length > 2) {
                errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.moreThanTwoBiologicalParents));
            }
            if (isBiologicalParentChildKind(parentChildKind) && (!parent.birthDate || !child.birthDate)) {
                warnings.push('Birth dates are unknown; the biological relationship timeline could not be checked.');
            }
            if (parent.birthDate && child.birthDate) {
                const ageGap = getAgeDifferenceInYears(parent.birthDate, child.birthDate);
                if (typeof ageGap === 'number') {
                    if (ageGap < 0) {
                        if (parentChildKind === 'biological' || !isNonBiologicalParentChildKind(parentChildKind)) {
                            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.biologicalParentTooYoung));
                        }
                        else {
                            warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.parentTooYoungForChild));
                        }
                    }
                    else if (ageGap < MIN_BIOLOGICAL_PARENT_AGE) {
                        if (parentChildKind === 'biological' || !isNonBiologicalParentChildKind(parentChildKind)) {
                            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.biologicalParentMinimumAge, { years: MIN_BIOLOGICAL_PARENT_AGE }));
                        }
                        else {
                            warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.parentChildKindConflict, { years: MIN_BIOLOGICAL_PARENT_AGE }));
                        }
                    }
                }
            }
            if (parent.deathDate && child.birthDate && (0, person_date_1.isDefinitelyBefore)(parent.deathDate, child.birthDate)) {
                if (isBiologicalParentChildKind(parentChildKind)) {
                    errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.childBornAfterParentDeath));
                }
                else {
                    warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.childBornAfterParentDeath));
                }
            }
            if (isBiologicalParentChildKind(parentChildKind) && child.lastName.trim()) {
                const biologicalParents = nextBiologicalParentIds
                    .map((parentId) => peopleById.get(parentId))
                    .filter((candidate) => Boolean(candidate));
                const noNonBiologicalContext = relationships
                    .filter((relationship) => relationship.id !== ignoreRelationshipId)
                    .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === toPersonId)
                    .every((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
                    && isBiologicalParentChildKind(parentChildKind);
                const childSurname = normaliseNamePart(child.lastName);
                const childMaidenName = normaliseNamePart(child.maidenName);
                const differsFromAllBiologicalParents = biologicalParents.length >= 2 && biologicalParents.every((biologicalParent) => {
                    const parentCurrentSurname = normaliseNamePart(biologicalParent.lastName);
                    const parentBirthSurname = normaliseNamePart(biologicalParent.maidenName);
                    return childSurname !== parentCurrentSurname
                        && childSurname !== parentBirthSurname
                        && (!childMaidenName || childMaidenName !== parentCurrentSurname);
                });
                if (differsFromAllBiologicalParents && noNonBiologicalContext && !child.maidenName?.trim()) {
                    warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.childSurnameDiffersFromBiologicalParents));
                }
            }
            if (child.birthDate) {
                const siblingIds = new Set();
                nextBiologicalParentIds.forEach((parentId) => {
                    relationships
                        .filter((relationship) => relationship.id !== ignoreRelationshipId)
                        .filter((relationship) => relationship.type === 'parent-child' && relationship.fromPersonId === parentId)
                        .filter((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
                        .forEach((relationship) => {
                        if (relationship.toPersonId !== toPersonId) {
                            siblingIds.add(relationship.toPersonId);
                        }
                    });
                });
                const implausiblyCloseSibling = [...siblingIds]
                    .map((siblingId) => peopleById.get(siblingId))
                    .find((sibling) => {
                    if (!sibling?.birthDate) {
                        return false;
                    }
                    const daysApart = diffDays(child.birthDate, sibling.birthDate);
                    if (typeof daysApart !== 'number' || daysApart === 0 || daysApart >= 240) {
                        return false;
                    }
                    return !hasMultipleBirthHint(child) && !hasMultipleBirthHint(sibling);
                });
                if (implausiblyCloseSibling) {
                    warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.siblingBirthDatesTooClose));
                }
            }
        }
        if (type === 'spouse') {
            const biologicalChildrenForParent = (parentId) => new Set(relationships
                .filter((relationship) => relationship.id !== ignoreRelationshipId)
                .filter((relationship) => relationship.type === 'parent-child' && relationship.fromPersonId === parentId)
                .filter((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
                .map((relationship) => relationship.toPersonId));
            const firstParentChildren = biologicalChildrenForParent(fromPersonId);
            const sharedBiologicalChildIds = [...biologicalChildrenForParent(toPersonId)]
                .filter((childId) => firstParentChildren.has(childId));
            const hasImplausibleSharedChildTimeline = sharedBiologicalChildIds.some((childId) => {
                const child = peopleById.get(childId);
                const firstParent = peopleById.get(fromPersonId);
                const secondParent = peopleById.get(toPersonId);
                if (!child?.birthDate || !firstParent || !secondParent) {
                    return false;
                }
                const firstAgeGap = firstParent.birthDate ? getAgeDifferenceInYears(firstParent.birthDate, child.birthDate) : null;
                const secondAgeGap = secondParent.birthDate ? getAgeDifferenceInYears(secondParent.birthDate, child.birthDate) : null;
                const bornAfterFirstParentDeath = Boolean(firstParent.deathDate && (0, person_date_1.isDefinitelyBefore)(firstParent.deathDate, child.birthDate));
                const bornAfterSecondParentDeath = Boolean(secondParent.deathDate && (0, person_date_1.isDefinitelyBefore)(secondParent.deathDate, child.birthDate));
                return bornAfterFirstParentDeath
                    || bornAfterSecondParentDeath
                    || (typeof firstAgeGap === 'number' && firstAgeGap < MIN_BIOLOGICAL_PARENT_AGE)
                    || (typeof secondAgeGap === 'number' && secondAgeGap < MIN_BIOLOGICAL_PARENT_AGE);
            });
            if (hasImplausibleSharedChildTimeline) {
                warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.spousesTimelineImplausible));
            }
            if (isCurrentSpouseStatus(relationshipStatus)) {
                const currentSpouseExists = relationships
                    .filter((relationship) => relationship.id !== ignoreRelationshipId)
                    .filter((relationship) => relationship.type === 'spouse')
                    .filter((relationship) => isCurrentSpouseStatus(relationship.relationshipStatus))
                    .some((relationship) => {
                    const firstPeer = getRelationshipPeerId(relationship, fromPersonId);
                    const secondPeer = getRelationshipPeerId(relationship, toPersonId);
                    return (firstPeer && firstPeer !== toPersonId)
                        || (secondPeer && secondPeer !== fromPersonId);
                });
                if (currentSpouseExists) {
                    warnings.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.anotherCurrentPartnerExists));
                }
            }
        }
    }
    if (findDuplicateRelationship(relationships, type, fromPersonId, toPersonId, ignoreRelationshipId)) {
        errors.push(type === 'spouse'
            ? (0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.spouseRelationshipAlreadyExists)
            : (0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.alreadyExists));
        return { errors, warnings };
    }
    const { childrenByParentId, parentIdsByChildId } = buildParentChildIndex(relationships, ignoreRelationshipId);
    if (type === 'spouse') {
        if (isAncestorOf(childrenByParentId, fromPersonId, toPersonId) || isAncestorOf(childrenByParentId, toPersonId, fromPersonId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.spouseAncestorDescendant));
        }
        if (sharesParent(parentIdsByChildId, fromPersonId, toPersonId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.spouseBetweenSiblings));
        }
    }
    if (type === 'parent-child') {
        if (findDuplicateRelationship(relationships, 'spouse', fromPersonId, toPersonId, ignoreRelationshipId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.parentChildAlsoSpouse));
        }
        if (isAncestorOf(childrenByParentId, fromPersonId, toPersonId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.alreadyAncestor));
        }
        if (sharesParent(parentIdsByChildId, fromPersonId, toPersonId)) {
            errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.siblingsCannotBeParentChild));
        }
    }
    if (type === 'parent-child' && buildsCircularAncestry(relationships, fromPersonId, toPersonId, ignoreRelationshipId)) {
        errors.push((0, i18n_1.translate)(keys_1.I18N_KEYS.relationship.circularAncestryLoop));
    }
    return { errors, warnings };
}
function getRelationshipValidationResolution(input) {
    const feedback = getRelationshipValidationFeedback(input);
    return {
        blockingErrors: feedback.errors,
        softWarnings: feedback.warnings,
    };
}
