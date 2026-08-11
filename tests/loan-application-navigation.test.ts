import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loanApplicationModal = () =>
  readFile(new URL('../components/LoanApplicationModal.tsx', import.meta.url), 'utf8');

test('advancing the loan form cannot reuse the clicked button as a submit control', async () => {
  const source = await loanApplicationModal();

  assert.match(
    source,
    /const handleNextStep = \(event\?: React\.SyntheticEvent\) => \{\s*event\?\.preventDefault\(\);/,
  );
  assert.match(source, /key="next-btn"\s*type="button"/);
  assert.match(source, /key="submit-btn"\s*type="submit"/);
});
