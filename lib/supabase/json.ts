import type { Json } from './database.types';

export type JsonObject = { [key: string]: Json | undefined };

export function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonObject(value: Json | null | undefined): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function jsonString(
  value: Json | undefined,
  fallback = '',
): string {
  return typeof value === 'string' ? value : fallback;
}

export function jsonBoolean(
  value: Json | undefined,
  fallback = false,
): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function jsonStringValues(value: Json): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(jsonStringValues);
  if (isJsonObject(value)) {
    return Object.values(value).flatMap((entry) =>
      entry === undefined ? [] : jsonStringValues(entry),
    );
  }
  return [];
}
