"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferredPersonPhoto = getPreferredPersonPhoto;
exports.getPersonTreeMembershipIds = getPersonTreeMembershipIds;
exports.getDisplayPersonPhoto = getDisplayPersonPhoto;
exports.getPersonFallbackAvatarIcon = getPersonFallbackAvatarIcon;
exports.parsePersonDate = parsePersonDate;
exports.formatPersonDate = formatPersonDate;
exports.formatDate = formatDate;
exports.isPersonDeceased = isPersonDeceased;
exports.getPersonPresenceLabel = getPersonPresenceLabel;
exports.getPersonLifeSpanLabel = getPersonLifeSpanLabel;
exports.getLifeEventTypeLabel = getLifeEventTypeLabel;
const i18n_1 = require("../../i18n");
const keys_1 = require("../../i18n/keys");
function getPreferredPersonPhoto(person) {
    if (!person?.preferredPhotoId) {
        return null;
    }
    return person.photos.find((photo) => photo.id === person.preferredPhotoId) ?? null;
}
function getPersonTreeMembershipIds(person) {
    if (!person) {
        return [];
    }
    if (Array.isArray(person.treeMembershipIds) && person.treeMembershipIds.length > 0) {
        return [...new Set(person.treeMembershipIds)];
    }
    return person.treeId ? [person.treeId] : [];
}
function getDisplayPersonPhoto(person) {
    const preferredPhoto = getPreferredPersonPhoto(person);
    if (preferredPhoto) {
        return preferredPhoto.displayUrl
            ? {
                ...preferredPhoto,
                url: preferredPhoto.displayUrl,
                path: preferredPhoto.displayPath ?? preferredPhoto.path,
            }
            : preferredPhoto;
    }
    return person?.photos[0] ?? null;
}
function getPersonAgeInYears(person) {
    if (!person?.birthDate) {
        return null;
    }
    const birthDate = parsePersonDate(person.birthDate);
    if (!birthDate) {
        return null;
    }
    const endDate = parsePersonDate(person.deathDate) ?? new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDelta = endDate.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && endDate.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    return age;
}
function getPersonFallbackAvatarIcon(person) {
    const ageInYears = getPersonAgeInYears(person);
    if (typeof ageInYears === 'number' && ageInYears >= 0 && ageInYears <= 2) {
        return 'baby-face-outline';
    }
    if (person?.gender === 'female') {
        return 'human-female';
    }
    if (person?.gender === 'male') {
        return 'human-male';
    }
    return 'account';
}
function parsePersonDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatPersonDate(value) {
    const parsed = parsePersonDate(value);
    if (!parsed) {
        return value || (0, i18n_1.translate)(keys_1.I18N_KEYS.common.unknown);
    }
    return formatDate(parsed);
}
function formatDate(date) {
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}
function isPersonDeceased(person) {
    return Boolean(person?.deathDate?.trim());
}
function getPersonPresenceLabel(person) {
    if (person?.deathDate) {
        return `${(0, i18n_1.translate)(keys_1.I18N_KEYS.personProfile.inMemory)} • ${formatPersonDate(person.deathDate)}`;
    }
    return (0, i18n_1.translate)(keys_1.I18N_KEYS.common.present);
}
function getPersonLifeSpanLabel(person) {
    if (!person) {
        return (0, i18n_1.translate)(keys_1.I18N_KEYS.personProfile.unknownLifespan);
    }
    const birthLabel = person.birthDate ? formatPersonDate(person.birthDate) : (0, i18n_1.translate)(keys_1.I18N_KEYS.personProfile.birthDateUnknown);
    const deathLabel = person.deathDate ? formatPersonDate(person.deathDate) : (0, i18n_1.translate)(keys_1.I18N_KEYS.common.present);
    return `${birthLabel} - ${deathLabel}`;
}
function getLifeEventTypeLabel(type) {
    switch (type) {
        case 'married':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeMarried);
        case 'divorced':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeDivorced);
        case 'moved':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeMoved);
        case 'graduated':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeGraduated);
        case 'retired':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeRetired);
        case 'milestone':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeMilestone);
        case 'death':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeDeath);
        case 'child-born':
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeChildBorn);
        default:
            return (0, i18n_1.translate)(keys_1.I18N_KEYS.memories.eventTypeCustom);
    }
}
