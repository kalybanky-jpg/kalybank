export interface PersonName {
  firstName: string;
  lastName: string;
}

export function splitFullName(value: unknown): PersonName | null {
  if (typeof value !== 'string') return null;

  const normalizedName = value.trim().replace(/\s+/g, ' ');
  if (!normalizedName) return null;

  const parts = normalizedName.split(' ');
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}
