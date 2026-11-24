-- ATS project. Catalog-only gate; produces one JSON object with no definitions or row data.
begin read only;
with relations as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='ats_dev' and c.relkind in ('r','p')
    and c.relname in ('requisitions','candidates','interviews','candidate_resumes','memberships','requisition_candidates')
), functions as (
  select p.*,n.nspname as schema_name from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and (
    (n.nspname='public' and (p.proname like 'ats\_admin\_%' or p.proname in ('ats_service_sync_returns','ats_service_returns_resume_imported')))
    or (n.nspname in ('ats_dev','public') and p.proname='ats_is_recruiter_admin'))
)
select jsonb_build_object(
  'anonSchemaUsage',coalesce((select has_schema_privilege('anon',n.oid,'USAGE') from pg_namespace n where n.nspname='ats_dev'),false),
  'policies',coalesce((select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,
    'name',policyname,'roles',roles,'command',cmd,'permissive',permissive)
    order by schemaname,tablename,policyname) from pg_policies
    where (schemaname='ats_dev' and tablename in (select relname from relations))
      or (schemaname='storage' and tablename='objects')),'[]'),
  'tables',coalesce((select jsonb_object_agg(r.relname,jsonb_build_object(
    'columns',(select jsonb_object_agg(a.attname,jsonb_build_object(
      'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'hasDefault',a.atthasdef,'identity',a.attidentity,'generated',a.attgenerated))
      from pg_catalog.pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
    'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity,
    'crud',(select jsonb_object_agg(role_name,(select jsonb_object_agg(operation,
      pg_catalog.has_table_privilege(role_name,r.oid,operation))
      from unnest(array['SELECT','INSERT','UPDATE','DELETE']) operations(operation)))
      from unnest(array['anon','authenticated']) roles(role_name)),
    'triggers',coalesce((select jsonb_agg(t.tgname order by t.tgname) from pg_catalog.pg_trigger t
      where t.tgrelid=r.oid and not t.tgisinternal),'[]'),
    'constraints',coalesce((select jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype,
      'target',case when k.contype='f' then k.confrelid::regclass::text end) order by k.conname)
      from pg_catalog.pg_constraint k where k.conrelid=r.oid),'[]'),
    'conflictKeys',coalesce((select jsonb_agg(
      (select jsonb_agg(a.attname order by a.attname)
       from unnest(i.indkey) with ordinality keys(col,ord)
       join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attnum=keys.col
       where keys.ord<=i.indnkeyatts))
      from pg_catalog.pg_index i where i.indrelid=r.oid and i.indisunique and i.indisvalid
        and i.indisready and i.indimmediate and i.indpred is null and i.indexprs is null),'[]')
  )) from relations r),'{}'),
  'rpcs',coalesce((select jsonb_agg(jsonb_build_object(
    'schema',p.schema_name,'name',p.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
    'inputs',coalesce((select jsonb_agg(args.name order by args.ord)
      from unnest(p.proargnames) with ordinality args(name,ord)
      where p.proargmodes is null or p.proargmodes[args.ord] in ('i','b','v')),'[]'),
    'optionalInputs',p.pronargdefaults,
    'result',pg_catalog.pg_get_function_result(p.oid),'securityDefiner',p.prosecdef,
    'anonExecute',pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticatedExecute',pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'serviceExecute',pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'))
    order by p.proname,p.oid) from functions p),'[]')
);
rollback;
