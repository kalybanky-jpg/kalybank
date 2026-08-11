import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  parseSupportConversation,
  parseSupportConversationLimit,
  parseSupportConversations,
  stripTawkIdentityMarker,
  SUPPORT_TRANSCRIPT_ADMIN_SELECT,
} from '../lib/support/transcripts';

const TRANSCRIPT_ID = '550e8400-e29b-41d4-a716-446655440000';
const IDENTITY_MARKER =
  '[mz1:550e8400-e29b-41d4-a716-446655440001:6587a8709b1386f458b21af9caab242d]';

function transcriptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TRANSCRIPT_ID,
    tawk_chat_id: 'chat-123',
    event_at: '2026-08-10T12:30:00+02:00',
    created_at: '2026-08-10T10:31:00.000Z',
    identity_status: 'resolved',
    notification_display_name: 'Ada Lovelace',
    notification_email: 'ADA@EXAMPLE.COM',
    notification_language: 'EN_us',
    visitor_email_normalized: 'visitor@example.com',
    payload: {
      chat: {
        visitor: {
          name: `Editable visitor ${IDENTITY_MARKER}`,
          email: 'editable@example.com',
        },
        messages: [],
      },
    },
    ...overrides,
  };
}

test('le marqueur d’identité tawk est supprimé de tous les noms exposés', () => {
  assert.equal(
    stripTawkIdentityMarker(`Ada Lovelace ${IDENTITY_MARKER}`),
    'Ada Lovelace',
  );
  assert.equal(stripTawkIdentityMarker(IDENTITY_MARKER), null);
  assert.equal(stripTawkIdentityMarker('Ada [mz1:incomplet]'), 'Ada [mz1:incomplet]');
});

test('une transcription tawk devient un DTO minimal et normalisé', () => {
  const conversation = parseSupportConversation(
    transcriptRow({
      payload: {
        chat: {
          visitor: {
            name: `Editable visitor ${IDENTITY_MARKER}`,
            email: 'editable@example.com',
          },
          messages: [
            {
              id: 'message-1',
              time: '2026-08-10T10:15:00Z',
              sender: { t: 'v', n: `Ada Lovelace ${IDENTITY_MARKER}` },
              msg: '  Bonjour\r\nPouvez-vous m’aider ?  ',
              attchs: [
                {
                  content: {
                    file: {
                      name: 'preuve.pdf',
                      url: 'https://files.example.com/preuve.pdf',
                      mimeType: 'Application/PDF',
                      size: 1234,
                    },
                  },
                },
              ],
            },
            {
              sender: { t: 'a', n: 'Agent Monalyz' },
              msg: 'Nous vérifions votre dossier.',
              time: 'not-a-date',
            },
          ],
        },
      },
    }),
  );

  assert.deepEqual(conversation, {
    id: TRANSCRIPT_ID,
    chatId: 'chat-123',
    occurredAt: '2026-08-10T10:30:00.000Z',
    createdAt: '2026-08-10T10:31:00.000Z',
    identityStatus: 'resolved',
    visitor: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      language: 'en-us',
    },
    messages: [
      {
        id: 'message-1',
        senderType: 'visitor',
        senderName: 'Ada Lovelace',
        text: 'Bonjour\nPouvez-vous m’aider ?',
        createdAt: '2026-08-10T10:15:00.000Z',
        attachments: [
          {
            name: 'preuve.pdf',
            url: 'https://files.example.com/preuve.pdf',
            contentType: 'application/pdf',
            size: 1234,
          },
        ],
      },
      {
        id: null,
        senderType: 'agent',
        senderName: 'Agent Monalyz',
        text: 'Nous vérifions votre dossier.',
        createdAt: null,
        attachments: [],
      },
    ],
  });
});

test('les données actives, les messages vides et les pièces jointes dangereuses sont écartés', () => {
  const conversation = parseSupportConversation(
    transcriptRow({
      notification_display_name: null,
      notification_email: null,
      notification_language: '../../fr',
      identity_status: 'not_found',
      payload: {
        chat: {
          visitor: {
            name: `Visitor ${IDENTITY_MARKER}`,
            email: 'VISITOR@EXAMPLE.COM',
          },
          messages: [
            null,
            { sender: { t: 'x', n: 'System\u0000' }, msg: '   ' },
            {
              sender: { t: 'x', n: 'System\u0000' },
              msg: 'Message système',
              attchs: [
                {
                  content: {
                    file: {
                      name: 'http.txt',
                      url: 'http://files.example.com/http.txt',
                    },
                  },
                },
                {
                  content: {
                    file: {
                      name: 'credentials.txt',
                      url: 'https://user:password@files.example.com/file.txt',
                    },
                  },
                },
                {
                  content: {
                    file: {
                      name: 'safe.txt\nheader',
                      url: 'https://files.example.com/safe.txt',
                      mimeType: 'text/plain; charset=utf-8',
                      size: -1,
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    }),
  );

  assert.ok(conversation);
  assert.deepEqual(conversation.visitor, {
    name: 'Visitor',
    email: 'visitor@example.com',
    language: null,
  });
  assert.deepEqual(conversation.messages, [
    {
      id: null,
      senderType: 'system',
      senderName: 'System',
      text: 'Message système',
      createdAt: null,
      attachments: [
        {
          name: 'safe.txt header',
          url: 'https://files.example.com/safe.txt',
          contentType: null,
          size: null,
        },
      ],
    },
  ]);
});

test('les lignes invalides sont ignorées et la pagination reste bornée', () => {
  assert.equal(parseSupportConversation({}), null);
  assert.equal(
    parseSupportConversation(transcriptRow({ identity_status: 'forged' })),
    null,
  );
  assert.deepEqual(
    parseSupportConversations([{}, transcriptRow()]).map(({ id }) => id),
    [TRANSCRIPT_ID],
  );
  assert.equal(parseSupportConversationLimit(null), 50);
  assert.equal(parseSupportConversationLimit('0'), 50);
  assert.equal(parseSupportConversationLimit('25'), 25);
  assert.equal(parseSupportConversationLimit('999'), 100);
  assert.equal(parseSupportConversationLimit('1e2'), 50);
});

test('la route admin authentifie avant le client privilégié et sélectionne le strict nécessaire', async () => {
  const route = await readFile(
    new URL('../app/api/admin/support-conversations/route.ts', import.meta.url),
    'utf8',
  );
  const getUserIndex = route.indexOf('supabase.auth.getUser()');
  const roleIndex = route.indexOf("'current_app_role'");
  const privilegedIndex = route.indexOf('createPrivilegedClient(');
  assert.ok(getUserIndex >= 0 && roleIndex > getUserIndex);
  assert.ok(privilegedIndex > roleIndex);
  assert.match(route, /role !== 'admin'/);
  assert.match(route, /\.select\(SUPPORT_TRANSCRIPT_ADMIN_SELECT\)/);
  assert.match(route, /\.order\('event_at', \{ ascending: false \}\)/);
  assert.match(route, /\.limit\(limit\)/);

  assert.deepEqual(SUPPORT_TRANSCRIPT_ADMIN_SELECT.split(','), [
    'id',
    'tawk_chat_id',
    'event_at',
    'created_at',
    'identity_status',
    'notification_display_name',
    'notification_email',
    'notification_language',
    'visitor_email_normalized',
    'payload',
  ]);
  for (const forbidden of [
    'raw_body',
    'raw_body_sha256',
    'email_request_payload',
    'email_provider_message_id',
    'processing_token',
  ]) {
    assert.doesNotMatch(SUPPORT_TRANSCRIPT_ADMIN_SELECT, new RegExp(forbidden));
  }
});
