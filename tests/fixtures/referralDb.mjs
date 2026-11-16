import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function createReferralDb() {
  const db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.admin_users(email text,role text,active boolean);
    create table public.job_postings(id uuid primary key,title text,department text,is_active boolean);
    create table public.candidate_applications(id uuid primary key,email text not null,first_name text,last_name text,position_id uuid,position_title text,status text);
    grant insert on public.candidate_applications to anon,authenticated;
    grant select on public.job_postings to anon,authenticated;`);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@example.test',now()),($2,'sales@example.test',now()),($3,'outsider@example.test',now()),($4,'unverified@example.test',null)", [id(1), id(2), id(3), id(4)]);
  await db.exec("insert into admin_users values('admin@example.test','admin',true)");
  await db.query("insert into job_postings values($1,'Sales Executive','Sales',true),($2,'Sales Trainer','Sales',true)", [id(10), id(11)]);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261116135929_sales_employee_referrals.sql', import.meta.url), 'utf8'));
  return db;
}
export async function asUser(db, n) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
  await db.exec(n ? 'set role authenticated' : 'set role anon');
}
export async function seedEmployee(db) {
  await asUser(db, 1);
  return (await db.query("select public.save_sales_referral_employee(null,null,'Sales Employee','sales@example.test','2020-01-01',null,true,true) id")).rows[0].id;
}
