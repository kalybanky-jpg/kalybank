-- Preserve the deployed migration history while updating the product name
-- embedded in the four workflow functions that emit user-facing content.
do $migration$
declare
  function_definitions text[];
  function_definition text;
begin
  select array_agg(pg_get_functiondef(procedure.oid) order by procedure.proname)
  into function_definitions
  from pg_proc as procedure
  join pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.prokind = 'f'
    and procedure.proname = any (
      array[
        'review_kyc_application',
        'submit_loan_application',
        'transition_loan',
        'transition_transfer'
      ]
    )
    and pg_get_functiondef(procedure.oid) like '%KALY%';

  if coalesce(cardinality(function_definitions), 0) <> 4 then
    raise exception
      'BRAND_MIGRATION_EXPECTED_4_FUNCTIONS_FOUND_%',
      coalesce(cardinality(function_definitions), 0);
  end if;

  foreach function_definition in array function_definitions
  loop
    execute replace(function_definition, 'KALY', 'Monalyz');
  end loop;
end;
$migration$;
