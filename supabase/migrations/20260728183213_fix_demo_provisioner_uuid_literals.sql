-- Keep the deployed demo provisioner definition intact while making
-- its UUID constants explicit for plpgsql_check. This migration is safe on a
-- fresh database (immediately after the provisioner migration) and on the
-- already provisioned remote project.
do $migration$
declare
  previous_definition text;
  updated_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.provision_demo_accounts(uuid,uuid,text)'::regprocedure
  )
  into previous_definition;

  if previous_definition is null then
    raise exception 'DEMO_PROVISIONER_FUNCTION_MISSING';
  end if;

  updated_definition := pg_catalog.replace(
    previous_definition,
    $old$demo_kyc_id constant uuid := 'd3000000-0000-4000-8000-000000000001';$old$,
    $new$demo_kyc_id constant uuid := uuid 'd3000000-0000-4000-8000-000000000001';$new$
  );
  updated_definition := pg_catalog.replace(
    updated_definition,
    $old$demo_kyc_idempotency_key constant uuid := 'd3000000-0000-4000-8000-000000000002';$old$,
    $new$demo_kyc_idempotency_key constant uuid := uuid 'd3000000-0000-4000-8000-000000000002';$new$
  );
  updated_definition := pg_catalog.replace(
    updated_definition,
    $old$demo_position_id constant uuid := 'd3000000-0000-4000-8000-000000000003';$old$,
    $new$demo_position_id constant uuid := uuid 'd3000000-0000-4000-8000-000000000003';$new$
  );

  if updated_definition = previous_definition
     or pg_catalog.strpos(
       updated_definition,
       $expected$demo_kyc_id constant uuid := uuid 'd3000000-0000-4000-8000-000000000001';$expected$
     ) = 0
     or pg_catalog.strpos(
       updated_definition,
       $expected$demo_kyc_idempotency_key constant uuid := uuid 'd3000000-0000-4000-8000-000000000002';$expected$
     ) = 0
     or pg_catalog.strpos(
       updated_definition,
       $expected$demo_position_id constant uuid := uuid 'd3000000-0000-4000-8000-000000000003';$expected$
     ) = 0 then
    raise exception 'DEMO_PROVISIONER_UUID_LITERAL_REWRITE_FAILED';
  end if;

  execute updated_definition;
end;
$migration$;
