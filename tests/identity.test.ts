import assert from 'node:assert/strict';
import test from 'node:test';
import { splitFullName } from '../lib/identity';

test('sépare le nom complet saisi lors de l’inscription', () => {
  assert.deepEqual(splitFullName('  Aïcha   Martin  '), {
    firstName: 'Aïcha',
    lastName: 'Martin',
  });
  assert.deepEqual(splitFullName('Jean Dupont de Nemours'), {
    firstName: 'Jean',
    lastName: 'Dupont de Nemours',
  });
});

test('accepte un nom simple et ignore les valeurs absentes', () => {
  assert.deepEqual(splitFullName('Madonna'), {
    firstName: 'Madonna',
    lastName: '',
  });
  assert.equal(splitFullName('   '), null);
  assert.equal(splitFullName(undefined), null);
});
