import type { Database } from './database.types';

type PublicFunctions = Database['public']['Functions'];
type PublicFunctionName = keyof PublicFunctions;
type PublicFunctionArgs<Name extends PublicFunctionName> =
  PublicFunctions[Name] extends { Args: infer Args } ? Args : never;

type NullableArgumentKeys = {
  complete_official_document:
    | 'p_content_hash'
    | 'p_error'
    | 'p_storage_path';
  branch_manager_issue_official_document:
    | 'p_account_id'
    | 'p_transfer_id'
    | 'p_loan_id'
    | 'p_period_start'
    | 'p_period_end';
  decide_kyc_application: 'p_reason_code';
  request_kyc_information: 'p_due_at';
  submit_transfer_intent: 'p_motive';
};

type FunctionWithNullableArguments = keyof NullableArgumentKeys &
  PublicFunctionName;

type ArgsWithKnownNulls<Name extends FunctionWithNullableArguments> = Omit<
  PublicFunctionArgs<Name>,
  NullableArgumentKeys[Name]
> & {
  [Key in NullableArgumentKeys[Name]]: Key extends keyof PublicFunctionArgs<Name>
    ? PublicFunctionArgs<Name>[Key] | null
    : never;
};

/**
 * Supabase's generated TypeScript currently loses PostgreSQL function argument
 * nullability. Keep the exception narrow and checked against the SQL signatures.
 */
export function rpcArgsWithKnownNulls<
  Name extends FunctionWithNullableArguments,
>(
  args: ArgsWithKnownNulls<Name>,
): PublicFunctionArgs<Name> {
  return args as PublicFunctionArgs<Name>;
}
