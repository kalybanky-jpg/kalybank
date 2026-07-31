import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currencyExponent,
  fromMinorUnits,
  isTerminalWorkflowStatus,
  loanProgress,
  maskFinancialIdentifier,
  toMinorUnits,
  transferProgress,
} from '../lib/domain/financial';

test('currency exponents and minor-unit conversion remain exact for supported currencies', () => {
  assert.equal(currencyExponent('EUR'), 2);
  assert.equal(currencyExponent('jpy'), 0);
  assert.equal(currencyExponent('KWD'), 3);
  assert.equal(toMinorUnits(12.34, 'EUR'), 1234);
  assert.equal(toMinorUnits(12, 'JPY'), 12);
  assert.equal(toMinorUnits(1.234, 'KWD'), 1234);
  assert.equal(fromMinorUnits(1234, 'EUR'), 12.34);
});

test('invalid or unsafe amounts are rejected before persistence', () => {
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => toMinorUnits(amount, 'EUR'));
  }
  assert.throws(() => toMinorUnits(Number.MAX_SAFE_INTEGER, 'KWD'));
});

test('external financial identifiers are masked in UI projections', () => {
  const masked = maskFinancialIdentifier('FR76 1234 5678 9012');
  assert.equal(masked.endsWith('9012'), true);
  assert.equal(masked.includes('FR76'), false);
  assert.throws(() => maskFinancialIdentifier('  '));
});

test('workflow progress never represents execution before evidence and confirmation', () => {
  assert.equal(transferProgress('under_review', 0), 0);
  assert.equal(transferProgress('under_review', 1), 25);
  assert.equal(transferProgress('under_review', 2), 50);
  assert.equal(transferProgress('under_review', 3), 75);
  assert.equal(transferProgress('approved_for_external_execution', 4), 75);
  assert.equal(transferProgress('external_execution_recorded', 4), 90);
  assert.equal(transferProgress('external_settlement_confirmed', 4), 100);
  assert.equal(transferProgress('rejected', 4), 0);
  assert.equal(loanProgress('approved_for_external_funding', 4), 75);
  assert.equal(loanProgress('external_funding_recorded', 4), 90);
  assert.equal(loanProgress('external_settlement_confirmed', 4), 100);
});

test('terminal statuses are explicit and finite', () => {
  assert.equal(isTerminalWorkflowStatus('external_settlement_confirmed'), true);
  assert.equal(isTerminalWorkflowStatus('rejected'), true);
  assert.equal(isTerminalWorkflowStatus('under_review'), false);
});
