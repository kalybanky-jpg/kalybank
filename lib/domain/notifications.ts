import type { Json } from '../supabase/database.types';
import { jsonObject } from '../supabase/json';
import type { NotificationMessageKey } from '../types';
import type { SystemNotification } from '../types';

export const NOTIFICATION_MESSAGE_KEYS = [
  'generic_info',
  'transfer_submitted',
  'transfer_approved',
  'transfer_completed',
  'transfer_rejected',
  'transfer_failed',
  'loan_submitted',
  'loan_approved',
  'loan_disbursed',
  'loan_rejected',
  'loan_failed',
  'kyc_submitted',
  'kyc_information_requested',
  'kyc_resubmitted',
  'kyc_approved',
  'kyc_rejected',
  'document_available',
] as const satisfies readonly NotificationMessageKey[];

const notificationMessageKeys = new Set<string>(NOTIFICATION_MESSAGE_KEYS);
const notificationTypes = new Set<SystemNotification['type']>([
  'info',
  'success',
  'alert',
  'transfer',
  'loan',
  'kyc',
]);

export function parseNotificationMessageKey(
  value: string,
): NotificationMessageKey {
  return notificationMessageKeys.has(value)
    ? (value as NotificationMessageKey)
    : 'generic_info';
}

export function parseNotificationMessageParams(
  value: Json,
): Record<string, unknown> {
  return jsonObject(value);
}

export function parseNotificationType(value: string): SystemNotification['type'] {
  return notificationTypes.has(value as SystemNotification['type'])
    ? (value as SystemNotification['type'])
    : 'info';
}
