"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personDateBounds = personDateBounds;
exports.isDefinitelyBefore = isDefinitelyBefore;
exports.isExactPersonDate = isExactPersonDate;
/** Partial dates stay partial; never invent a day for genealogy records. */
function personDateBounds(value) {
    const match = /^(~)?(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(value.trim());
    if (!match)
        return null;
    const year = Number(match[2]);
    if (year < 1)
        return null;
    if (!match[3]) {
        const tolerance = match[1] ? 5 : 0;
        return { earliest: `${String(Math.max(1, year - tolerance)).padStart(4, '0')}-01-01`, latest: `${String(year + tolerance).padStart(4, '0')}-12-31` };
    }
    if (match[1])
        return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() + 1 !== Number(match[3]) || date.getDate() !== Number(match[4]))
        return null;
    return { earliest: value, latest: value };
}
function isDefinitelyBefore(left, right) {
    const a = personDateBounds(left);
    const b = personDateBounds(right);
    return Boolean(a && b && a.latest < b.earliest);
}
function isExactPersonDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(personDateBounds(value));
}
