import test from 'node:test';
import assert from 'node:assert/strict';
import { areTreesMergeCompatible, assertTreesMergeCompatible } from '../providers/tree-merge-eligibility';

function tree(id: string, name: string, aliases: string[][] = []) {
  return { id, name, surnameVariantGroups: aliases.map(([primarySurname, ...variants]) => ({
    id: primarySurname, primarySurname, variants, createdAt: '', updatedAt: '',
  })) };
}

test('tree eligibility allows the same surname with formatting and tree labels', () => {
  assert.equal(areTreesMergeCompatible(tree('a', ' KHUMALO Family Tree '), tree('b', 'Khumalo Branch')), true);
  assert.equal(areTreesMergeCompatible(tree('a', "O’Neil"), tree('b', 'o-neil')), true);
});

test('tree eligibility resolves saved variants from either tree and chained groups', () => {
  const a = tree('a', 'Khumalo');
  const b = tree('b', 'Kumalo', [['Cumalo', 'Kumalo'], ['Khumalo', 'Cumalo']]);
  assert.equal(areTreesMergeCompatible(a, b), true);
  assert.equal(areTreesMergeCompatible(b, a), true);
});

test('unrelated surnames and unrecorded similar spellings are ineligible', () => {
  const a = tree('a', 'Khumalo');
  assert.equal(areTreesMergeCompatible(a, tree('b', 'Zulu', [['Smith', 'Smyth']])), false);
  assert.equal(areTreesMergeCompatible(a, tree('b', 'Kumalo')), false);
  assert.throws(() => assertTreesMergeCompatible(a, tree('b', 'Zulu')), /Only trees sharing a surname/);
});

test('empty surnames and merging a tree with itself are ineligible', () => {
  assert.equal(areTreesMergeCompatible(tree('a', ''), tree('b', '')), false);
  assert.equal(areTreesMergeCompatible(tree('a', 'Khumalo'), tree('a', 'Khumalo')), false);
});


test('member current surnames and saved variants qualify even when tree names differ', () => {
  const a = tree('a', 'North');
  const b = tree('b', 'South');
  assert.equal(areTreesMergeCompatible(a, b, [{ lastName: 'Khumalo' }], [{ lastName: 'Khumalo' }]), true);
  assert.equal(areTreesMergeCompatible(a, tree('b', 'Khumalo'), [{ lastName: 'Khumalo' }]), true);
  assert.equal(areTreesMergeCompatible(a, tree('b', 'South', [['Khumalo', 'Cumalo']]), [{ lastName: 'Cumalo' }]), true);
});

test('maiden surnames never qualify a tree for merging', () => {
  const person = { lastName: 'Zulu', maidenName: 'Khumalo' };
  assert.equal(areTreesMergeCompatible(tree('a', 'North'), tree('b', 'Khumalo'), [person]), false);
});
