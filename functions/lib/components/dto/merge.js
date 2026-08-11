"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchStrengthLabel = getMatchStrengthLabel;
exports.getCanonicalPersonId = getCanonicalPersonId;
function getMatchStrengthLabel(score) {
    if (score >= 85) {
        return 'Very likely same person';
    }
    if (score >= 65) {
        return 'Possible match';
    }
    if (score >= 35) {
        return 'Weak match';
    }
    return 'Unlikely match';
}
function getCanonicalPersonId(person) {
    return person?.canonicalPersonId?.trim() || person?.id || '';
}
