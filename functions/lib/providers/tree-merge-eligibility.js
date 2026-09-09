"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.areTreesMergeCompatible = areTreesMergeCompatible;
exports.assertTreesMergeCompatible = assertTreesMergeCompatible;
function surnameKey(value) {
    return value.normalize('NFKC').trim().toLowerCase()
        .replace(/[.'’_\-\s]+/g, '');
}
function treeSurnameKey(name) {
    return surnameKey(name.trim().replace(/(?:\s+(?:family|tree|branch))+$/i, ''));
}
function surnameKeys(tree, people) {
    return new Set([
        treeSurnameKey(tree.name),
        ...tree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]).map(surnameKey),
        ...people.map((person) => surnameKey(person.lastName)),
    ].filter(Boolean));
}
function areTreesMergeCompatible(source, target, sourcePeople = [], targetPeople = []) {
    if (source.id === target.id)
        return false;
    const sourceKeys = surnameKeys(source, sourcePeople);
    const targetKeys = surnameKeys(target, targetPeople);
    return [...sourceKeys].some((key) => targetKeys.has(key));
}
function assertTreesMergeCompatible(source, target, sourcePeople = [], targetPeople = []) {
    if (!areTreesMergeCompatible(source, target, sourcePeople, targetPeople)) {
        throw new Error('Only trees sharing a surname through their names, saved variants, or members’ current surnames can merge. Maiden surnames do not qualify.');
    }
}
