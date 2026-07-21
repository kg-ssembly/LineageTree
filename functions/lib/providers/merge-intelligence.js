"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMergePreview = buildMergePreview;
const merge_1 = require("../components/dto/merge");
function normalise(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[.'’_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}
function tokenize(value) {
    return normalise(value)
        .split(' ')
        .map((part) => part.trim())
        .filter(Boolean);
}
function getDisplayName(person) {
    return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}
function getBirthYear(person) {
    return person.birthDate ? Number.parseInt(person.birthDate.slice(0, 4), 10) : null;
}
function buildSurnameSet(person, groups) {
    const values = new Set();
    const rawValues = [
        person.lastName,
        ...(person.surnameVariantHints ?? []),
    ];
    rawValues.forEach((value) => {
        const normalized = normalise(value);
        if (normalized) {
            values.add(normalized);
        }
    });
    groups.forEach((group) => {
        const variants = [group.primarySurname, ...group.variants].map(normalise);
        if (variants.some((variant) => values.has(variant))) {
            variants.forEach((variant) => {
                if (variant) {
                    values.add(variant);
                }
            });
        }
    });
    return values;
}
function buildRelationshipNamesByPersonId(peopleById, relationships) {
    const relationNamesByPersonId = new Map();
    peopleById.forEach((_person, personId) => {
        relationNamesByPersonId.set(personId, {
            parentNames: new Set(),
            childNames: new Set(),
            spouseNames: new Set(),
        });
    });
    relationships.forEach((relationship) => {
        if (relationship.type === 'parent-child') {
            const parent = peopleById.get(relationship.fromPersonId);
            const child = peopleById.get(relationship.toPersonId);
            if (!parent || !child) {
                return;
            }
            relationNamesByPersonId.get(child.id)?.parentNames.add(normalise(getDisplayName(parent)));
            relationNamesByPersonId.get(parent.id)?.childNames.add(normalise(getDisplayName(child)));
            return;
        }
        const left = peopleById.get(relationship.fromPersonId);
        const right = peopleById.get(relationship.toPersonId);
        if (!left || !right) {
            return;
        }
        relationNamesByPersonId.get(left.id)?.spouseNames.add(normalise(getDisplayName(right)));
        relationNamesByPersonId.get(right.id)?.spouseNames.add(normalise(getDisplayName(left)));
    });
    return relationNamesByPersonId;
}
function buildPersonMergeFacts(person, tree, relationNamesByPersonId) {
    const displayName = getDisplayName(person);
    return {
        person,
        displayName,
        fullName: normalise(displayName),
        firstName: normalise(person.firstName),
        middleNames: new Set(tokenize(person.middleNames ?? '')),
        surnames: buildSurnameSet(person, tree.surnameVariantGroups),
        birthYear: getBirthYear(person),
        relations: relationNamesByPersonId.get(person.id) ?? {
            parentNames: new Set(),
            childNames: new Set(),
            spouseNames: new Set(),
        },
        birthPlace: normalise(person.birthPlace ?? ''),
        hometown: normalise(person.hometown ?? ''),
        clanName: normalise(person.clanName ?? ''),
        familyBranch: normalise(person.familyBranch ?? ''),
    };
}
function buildTreeMergeFacts(bundle) {
    const peopleById = new Map(bundle.people.map((person) => [person.id, person]));
    const relationNamesByPersonId = buildRelationshipNamesByPersonId(peopleById, bundle.relationships);
    return bundle.people.map((person) => buildPersonMergeFacts(person, bundle.tree, relationNamesByPersonId));
}
function hasOverlap(left, right) {
    const smaller = left.size <= right.size ? left : right;
    const larger = left.size <= right.size ? right : left;
    for (const value of smaller) {
        if (larger.has(value)) {
            return true;
        }
    }
    return false;
}
function createSignal(label, weight, matched, detail) {
    return { label, weight, matched, detail };
}
function comparePeople(source, target) {
    const sourcePerson = source.person;
    const targetPerson = target.person;
    const signals = [];
    signals.push(createSignal('Full name', 24, source.fullName === target.fullName || source.firstName === target.firstName, `${source.displayName} vs ${target.displayName}`));
    signals.push(createSignal('Middle names', 6, source.middleNames.size > 0 && target.middleNames.size > 0 && hasOverlap(source.middleNames, target.middleNames), `${sourcePerson.middleNames ?? 'Unknown'} vs ${targetPerson.middleNames ?? 'Unknown'}`));
    signals.push(createSignal('Surname variants', 18, hasOverlap(source.surnames, target.surnames), `${sourcePerson.lastName} vs ${targetPerson.lastName}`));
    signals.push(createSignal('Gender', 4, sourcePerson.gender !== 'unspecified' && sourcePerson.gender === targetPerson.gender, `${sourcePerson.gender} vs ${targetPerson.gender}`));
    signals.push(createSignal('Birth year', 10, source.birthYear !== null && target.birthYear !== null && Math.abs(source.birthYear - target.birthYear) <= 2, `${source.birthYear ?? 'Unknown'} vs ${target.birthYear ?? 'Unknown'}`));
    signals.push(createSignal('Parents', 12, hasOverlap(source.relations.parentNames, target.relations.parentNames), `${source.relations.parentNames.size} vs ${target.relations.parentNames.size} parent links`));
    signals.push(createSignal('Spouse', 10, hasOverlap(source.relations.spouseNames, target.relations.spouseNames), `${source.relations.spouseNames.size} vs ${target.relations.spouseNames.size} spouse links`));
    signals.push(createSignal('Children', 7, hasOverlap(source.relations.childNames, target.relations.childNames), `${source.relations.childNames.size} vs ${target.relations.childNames.size} child links`));
    signals.push(createSignal('Birthplace / hometown', 5, Boolean(sourcePerson.birthPlace && targetPerson.birthPlace && source.birthPlace === target.birthPlace)
        || Boolean(sourcePerson.hometown && targetPerson.hometown && source.hometown === target.hometown), `${sourcePerson.birthPlace || sourcePerson.hometown || 'Unknown'} vs ${targetPerson.birthPlace || targetPerson.hometown || 'Unknown'}`));
    signals.push(createSignal('Clan / branch', 4, Boolean(sourcePerson.clanName && targetPerson.clanName && source.clanName === target.clanName)
        || Boolean(sourcePerson.familyBranch && targetPerson.familyBranch && source.familyBranch === target.familyBranch), `${sourcePerson.clanName || sourcePerson.familyBranch || 'Unknown'} vs ${targetPerson.clanName || targetPerson.familyBranch || 'Unknown'}`));
    signals.push(createSignal('Photos', 4, sourcePerson.photos.length > 0 && targetPerson.photos.length > 0, `${sourcePerson.photos.length} vs ${targetPerson.photos.length} photos`));
    const baseScore = signals.reduce((sum, signal) => sum + (signal.matched ? signal.weight : 0), 0);
    const guidedQuestions = [
        {
            id: `same-person-${sourcePerson.id}-${targetPerson.id}`,
            prompt: `Is ${source.displayName} the same person as ${target.displayName}?`,
        },
        {
            id: `same-parent-${sourcePerson.id}-${targetPerson.id}`,
            prompt: `Do these two people belong to the same family branch or share the same parents?`,
        },
    ];
    const conflicts = [];
    if (sourcePerson.birthDate && targetPerson.birthDate && sourcePerson.birthDate !== targetPerson.birthDate) {
        conflicts.push({
            matchId: `${sourcePerson.id}:${targetPerson.id}`,
            field: 'birthDate',
            sourceValue: sourcePerson.birthDate,
            targetValue: targetPerson.birthDate,
        });
    }
    if (sourcePerson.lastName && targetPerson.lastName && normalise(sourcePerson.lastName) !== normalise(targetPerson.lastName)) {
        conflicts.push({
            matchId: `${sourcePerson.id}:${targetPerson.id}`,
            field: 'surname',
            sourceValue: sourcePerson.lastName,
            targetValue: targetPerson.lastName,
        });
    }
    if (sourcePerson.hometown && targetPerson.hometown && source.hometown !== target.hometown) {
        conflicts.push({
            matchId: `${sourcePerson.id}:${targetPerson.id}`,
            field: 'hometown',
            sourceValue: sourcePerson.hometown,
            targetValue: targetPerson.hometown,
        });
    }
    return {
        id: `${sourcePerson.id}:${targetPerson.id}`,
        sourcePersonId: sourcePerson.id,
        targetPersonId: targetPerson.id,
        confidenceScore: Math.max(0, Math.min(99, baseScore)),
        confidenceLabel: (0, merge_1.getMatchStrengthLabel)(baseScore),
        signals,
        guidedQuestions,
        conflicts,
    };
}
function buildMergePreview(source, target) {
    const sourceFacts = buildTreeMergeFacts(source);
    const targetFacts = buildTreeMergeFacts(target);
    const matches = sourceFacts
        .flatMap((sourcePerson) => targetFacts.map((targetPerson) => comparePeople(sourcePerson, targetPerson)))
        .filter((match) => match.confidenceScore >= 35)
        .sort((left, right) => right.confidenceScore - left.confidenceScore)
        .slice(0, 25);
    return {
        sourceTree: {
            treeId: source.tree.id,
            treeName: source.tree.name,
            personCount: source.people.length,
        },
        targetTree: {
            treeId: target.tree.id,
            treeName: target.tree.name,
            personCount: target.people.length,
        },
        matches,
        duplicateCount: matches.filter((match) => match.confidenceScore >= 65).length,
        connectedRelationshipCount: matches.reduce((sum, match) => sum + match.signals.filter((signal) => signal.matched).length, 0),
        newBranchCount: Math.max(0, source.people.length - matches.length),
        conflicts: matches.flatMap((match) => match.conflicts),
        combinedAssetCount: source.people.reduce((sum, person) => sum + person.photos.length + person.lifeEvents.length, 0)
            + target.people.reduce((sum, person) => sum + person.photos.length + person.lifeEvents.length, 0),
    };
}
