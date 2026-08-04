export const EMAIL_OTP_LENGTH = 6 as const;

const EMAIL_OTP_PATTERN = new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`);

export function normalizeEmailOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isValidEmailOtp(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_OTP_PATTERN.test(value);
}
