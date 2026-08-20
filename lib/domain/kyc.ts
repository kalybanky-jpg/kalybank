import type { Json } from '../supabase/database.types';
import {
  jsonBoolean,
  jsonObject,
  jsonString,
  type JsonObject,
} from '../supabase/json';
import type {
  KYCApplication,
  KYCReviewState,
  KYCSelfieReviewState,
} from '../types';

export const KYC_EVIDENCE_KEYS = [
  'id_front',
  'id_back',
  'proof_of_address',
  'selfie',
] as const;

export type KycEvidenceKey = (typeof KYC_EVIDENCE_KEYS)[number];

export interface KycDraftForm {
  firstName: string;
  lastName: string;
  placeOfBirth: string;
  nationality: string;
  dateOfBirth: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  occupation: string;
  incomeRange: string;
  fatca: boolean;
  pep: boolean;
  documentType: string;
  documentNumber: string;
  issuingCountry: string;
  documentExpiresOn: string;
}

const STRING_DRAFT_FIELDS = [
  'firstName',
  'lastName',
  'placeOfBirth',
  'nationality',
  'dateOfBirth',
  'street',
  'postalCode',
  'city',
  'country',
  'occupation',
  'incomeRange',
  'documentType',
  'documentNumber',
  'issuingCountry',
  'documentExpiresOn',
] as const satisfies readonly (keyof KycDraftForm)[];

export function parseKycDraft(value: Json): Partial<KycDraftForm> {
  const record = jsonObject(value);
  const result: Partial<KycDraftForm> = {};

  for (const key of STRING_DRAFT_FIELDS) {
    if (typeof record[key] === 'string') {
      result[key] = record[key];
    }
  }
  if (typeof record.fatca === 'boolean') result.fatca = record.fatca;
  if (typeof record.pep === 'boolean') result.pep = record.pep;

  return result;
}

export function serializeKycDraft(form: KycDraftForm): JsonObject {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    placeOfBirth: form.placeOfBirth,
    nationality: form.nationality,
    dateOfBirth: form.dateOfBirth,
    street: form.street,
    postalCode: form.postalCode,
    city: form.city,
    country: form.country,
    occupation: form.occupation,
    incomeRange: form.incomeRange,
    fatca: form.fatca,
    pep: form.pep,
    documentType: form.documentType,
    documentNumber: form.documentNumber,
    issuingCountry: form.issuingCountry,
    documentExpiresOn: form.documentExpiresOn,
  };
}

export function parseKycAddress(value: Json): KYCApplication['address'] {
  const record = jsonObject(value);
  const complement = jsonString(record.complement);

  return {
    street: jsonString(record.street),
    ...(complement ? { complement } : {}),
    postalCode: jsonString(record.postalCode),
    city: jsonString(record.city),
    country: jsonString(record.country),
  };
}

export function parseKycDocumentPaths(
  value: Json,
): Partial<Record<KycEvidenceKey, string>> {
  const record = jsonObject(value);
  return Object.fromEntries(
    KYC_EVIDENCE_KEYS.flatMap((key) =>
      typeof record[key] === 'string' && record[key]
        ? [[key, record[key]]]
        : [],
    ),
  );
}

export function serializeKycDocumentPaths(
  paths: Partial<Record<KycEvidenceKey, string>>,
): JsonObject {
  return Object.fromEntries(
    KYC_EVIDENCE_KEYS.flatMap((key) =>
      typeof paths[key] === 'string' && paths[key]
        ? [[key, paths[key]]]
        : [],
    ),
  );
}

const REVIEW_STATES = new Set<KYCReviewState>([
  'pending',
  'compliant',
  'non_compliant',
]);
const SELFIE_REVIEW_STATES = new Set<KYCSelfieReviewState>([
  ...REVIEW_STATES,
  'not_applicable',
]);

const KYC_WORKFLOW_STATUSES = new Set<
  NonNullable<KYCApplication['workflowStatus']>
>([
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'needs_information',
  'resubmitted',
]);

const KYC_DOCUMENT_TYPES = new Set<
  NonNullable<KYCApplication['documentType']>
>(['national_identity_card', 'passport', 'residence_permit']);

export function parseKycReviewState(value: string): KYCReviewState {
  return REVIEW_STATES.has(value as KYCReviewState)
    ? (value as KYCReviewState)
    : 'pending';
}

export function parseKycSelfieReviewState(
  value: string,
): KYCSelfieReviewState {
  return SELFIE_REVIEW_STATES.has(value as KYCSelfieReviewState)
    ? (value as KYCSelfieReviewState)
    : 'pending';
}

export function parseKycWorkflowStatus(
  value: string,
): NonNullable<KYCApplication['workflowStatus']> {
  return KYC_WORKFLOW_STATUSES.has(
    value as NonNullable<KYCApplication['workflowStatus']>,
  )
    ? (value as NonNullable<KYCApplication['workflowStatus']>)
    : 'submitted';
}

export function parseKycDocumentType(
  value: string | null,
): KYCApplication['documentType'] {
  return value &&
    KYC_DOCUMENT_TYPES.has(value as NonNullable<KYCApplication['documentType']>)
    ? (value as NonNullable<KYCApplication['documentType']>)
    : undefined;
}

export function kycChangesToJson(
  changes: Record<string, Json | undefined>,
): JsonObject {
  return changes;
}

export function kycAddressToJson(form: KycDraftForm): JsonObject {
  return {
    street: form.street.trim(),
    postalCode: form.postalCode.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
  };
}

export function kycProfileToJson(form: KycDraftForm): JsonObject {
  return {
    occupation: form.occupation,
    incomeRange: form.incomeRange,
    fatca: jsonBoolean(form.fatca),
    pep: jsonBoolean(form.pep),
  };
}
