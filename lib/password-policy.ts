export const PASSWORD_MIN_LENGTH = 16;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const SUPABASE_PASSWORD_REQUIRED_CHARACTERS =
  "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~";

export function isStrongPassword(value: string) {
  const utf8Length = new TextEncoder().encode(value).byteLength;
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    utf8Length <= PASSWORD_MAX_LENGTH &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    [...value].some((character) => PASSWORD_SYMBOLS.includes(character)) &&
    !/\s/.test(value)
  );
}
