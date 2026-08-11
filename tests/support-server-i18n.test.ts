import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUPPORT_NOTIFICATION_COPY,
  interpolateSupportCopy,
  resolveSupportLanguage,
  supportNotificationCopy,
} from '../supabase/functions/_shared/support-i18n';

test('support e-mail, push and transcript copy covers all six customer languages', () => {
  assert.deepEqual(Object.keys(SUPPORT_NOTIFICATION_COPY), ['fr', 'en', 'de', 'es', 'it', 'nl']);
  const expectedKeys = Object.keys(SUPPORT_NOTIFICATION_COPY.fr).sort();

  for (const [language, copy] of Object.entries(SUPPORT_NOTIFICATION_COPY)) {
    assert.deepEqual(Object.keys(copy).sort(), expectedKeys, `${language} catalog shape`);
    for (const [key, value] of Object.entries(copy)) {
      assert.match(value, /\S/, `${language}.${key}`);
    }
  }
});

test('support locale resolution accepts Italian and Dutch regional tags', () => {
  assert.equal(resolveSupportLanguage('it-IT'), 'it');
  assert.equal(resolveSupportLanguage('NL_nl'), 'nl');
  assert.equal(resolveSupportLanguage('pt-BR'), 'fr');
  assert.equal(supportNotificationCopy('it').locale, 'it-IT');
  assert.equal(supportNotificationCopy('nl').locale, 'nl-NL');
});

test('Italian and Dutch support copy keeps the formal Lei/u tone', () => {
  const italian = SUPPORT_NOTIFICATION_COPY.it;
  const dutch = SUPPORT_NOTIFICATION_COPY.nl;
  assert.match(`${italian.pushBody} ${italian.emailIntroduction} ${italian.footer}`, /Sua|Suo|Lei/);
  assert.match(`${dutch.pushBody} ${dutch.emailIntroduction} ${dutch.footer}`, /Uw|uw|u/);
  assert.equal(
    interpolateSupportCopy(italian.emailSubject, { brandName: 'Monalyz' }),
    'La Sua conversazione con l’assistenza Monalyz',
  );
});
