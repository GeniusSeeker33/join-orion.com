import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferralDb, asUser, id, seedEmployee } from './fixtures/referralDb.mjs';
import { referralLink, referralCopy, payrollCsv } from '../src/lib/referrals.js';

test('share links preserve attribution and safe payroll exports', () => {
  const url = new URL(referralLink('ORION-ABC', 'email'));
  assert.equal(url.pathname, '/sales-executive'); assert.equal(url.searchParams.get('ref'), 'ORION-ABC'); assert.equal(url.searchParams.get('utm_medium'), 'email');
  assert.match(referralCopy(url.href), /may receive an employee referral bonus/);
  const csv = payrollCsv({ employees: [{ id: 'e', name: '=BAD()', email: 'test@example.test' }], claims: [{ id: 'c', employee_id: 'e', candidate_name: 'Comma, "Name"' }], milestones: [{ claim_id: 'c', state: 'approved', eligibility: 'Ready for verification', amount: 250 }, { claim_id: 'c', state: 'approved', eligibility: 'Employment changed; verify again', amount: 250 }] });
  assert.match(csv, /'=BAD/); assert.match(csv, /Comma, ""Name""/); assert.equal(csv.split('\r\n').length, 2);
});

test('real SQL enforces attribution, membership, employment, payroll and audit', async t => {
  const db = await createReferralDb();
  try {
    const employee = await seedEmployee(db);
    const getAdmin = async () => { await asUser(db, 1); return (await db.query('select public.read_sales_referral_admin() data')).rows[0].data; };
    const code = (await getAdmin()).employees[0].code;
    const apply = async (n, email, referral = code, job = id(10)) => { await asUser(db, null); return db.query("insert into candidate_applications values($1,$2,'New','Consultant',$3,'Sales Executive','new',$4)", [id(n), email, job, referral]); };
    const saveEmployee = async (overrides = {}) => { const e = (await getAdmin()).employees[0]; return db.query('select public.save_sales_referral_employee($1,$2,$3,$4,$5,$6,$7,$8)', [e.id, e.revision, e.name, overrides.email || e.email, e.started_on, overrides.last_employed_on ?? null, overrides.sales_eligible ?? true, overrides.sharing_enabled ?? true]); };
    let claim;
    const review = async (action, confirmed = true, milestone = '30_days') => { await asUser(db, 1); return db.query('select public.review_sales_referral_milestone($1,$2,$3,$4,$5)', [claim, milestone, action, confirmed, 'Verified HR / payroll batch 123']); };
    await t.test('anonymous and outsiders cannot read ledgers or enroll employees', async () => {
      await asUser(db, null); await assert.rejects(db.query('select public.read_sales_referral_admin()'), /permission denied/);
      await asUser(db, 3); await assert.rejects(db.query('select public.read_sales_referral_admin()'), /administrator access/);
      await assert.rejects(db.query('select public.read_my_sales_referral()'), /not enrolled/);
      await assert.rejects(db.query("select public.save_sales_referral_employee(null,null,'X','x@example.test','2020-01-01',null,true,true)"), /administrator access/);
      await assert.rejects(db.query('select * from referrals.employees'), /permission denied/);
      await asUser(db, 2); const mine = (await db.query('select public.read_my_sales_referral() data')).rows[0].data;
      assert.equal(mine.employee.code, code); assert.deepEqual(Object.keys(mine).sort(), ['application_count', 'employee', 'hired_count', 'paid_total']); assert.equal(JSON.stringify(mine).includes('candidate_email'), false);
    });
    await t.test('only valid active Sales codes accepted, no self-referral', async () => {
      await assert.rejects(apply(20, 'candidate@example.test', 'BAD'), /unavailable/);
      await assert.rejects(apply(20, 'candidate@example.test', code, id(11)), /unavailable/);
      await assert.rejects(apply(20, ' SALES@example.test '), /Self-referrals/);
      await saveEmployee({ sharing_enabled: false }); await assert.rejects(apply(20, 'candidate@example.test'), /unavailable/);
      await saveEmployee();
      await apply(20, 'Candidate@example.test', code.toLowerCase());
      await apply(21, ' candidate@EXAMPLE.test ');
      await apply(22, 'organic@example.test', null);
      const data = await getAdmin(); assert.equal(data.claims.length, 1); claim = data.claims[0].id; assert.equal(data.claims[0].application_id, id(20));
      await db.exec('reset role'); await assert.rejects(db.query('update candidate_applications set employee_referral_code=null where id=$1', [id(20)]), /locked/);
      await assert.rejects(saveEmployee({ email: 'different@example.test' }), /Email cannot change/);
    });
    await t.test('hire must be verified, then exact calendar milestones are generated', async () => {
      await db.exec('reset role'); await db.query("update referrals.claims set captured_at='2024-01-01' where id=$1", [claim]);
      await asUser(db, 1);
      await assert.rejects(db.query("select public.save_sales_referral_hire($1,1,'2024-02-29',null,true)", [claim]), /Mark this candidate Hired/);
      await db.exec('reset role'); await db.query("update candidate_applications set status='hired' where id=$1", [id(20)]); await asUser(db, 1);
      await assert.rejects(db.query("select public.save_sales_referral_hire($1,1,'2024-02-29',null,false)", [claim]), /Confirm the Sales Consultant/);
      await db.query("select public.save_sales_referral_hire($1,1,'2024-02-29',null,true)", [claim]);
      const data = await getAdmin(); assert.deepEqual(data.milestones.map(m => [m.due_on, m.amount]), [['2024-03-30', 250], ['2024-08-29', 250], ['2025-02-28', 500]]);
      await assert.rejects(db.query("select public.save_sales_referral_hire($1,1,'2024-02-29',null,true)", [claim]), /Referral changed/);
    });
    await t.test('requires confirmation and approval; changed employment invalidates payroll approval', async () => {
      await assert.rejects(review('paid'), /Verify and approve/);
      await assert.rejects(review('approve', false), /Confirm both/);
      await assert.rejects(review(null), /Confirm both/);
      await review('approve');
      await saveEmployee();
      await assert.rejects(review('paid'), /Employment changed/);
      await review('approve');
      await review('paid');
      await assert.rejects(review('paid'), /already recorded/);
      await assert.rejects(db.query("select public.save_sales_referral_hire($1,2,'2024-03-01',null,true)", [claim]), /Hire date is locked/);
    });
    await t.test('departed employees or consultants block further payments; paid history persists', async () => {
      await saveEmployee({ last_employed_on: '2025-01-01' });
      await assert.rejects(review('approve', true, '6_months'), /Referrer is no longer employed/);
      await asUser(db, 2); await assert.rejects(db.query('select public.read_my_sales_referral()'), /not enrolled/);
      await saveEmployee(); await asUser(db, 1);
      await db.query("select public.save_sales_referral_hire($1,2,'2024-02-29','2025-01-01',true)", [claim]);
      await assert.rejects(review('approve', true, '6_months'), /consultant is no longer employed/);
      const data = await getAdmin(); assert.equal(data.milestones.filter(m => m.state === 'paid').length, 1);
      await db.exec('reset role'); await assert.rejects(db.exec('delete from referrals.audit'), /immutable/);
    });
    await t.test('new hires cannot be paid early; disqualification blocks milestones', async () => {
      await apply(30, 'second@example.test');
      const data = await getAdmin(); const c = data.claims.find(c => c.application_id === id(30));
      await db.exec('reset role'); await db.query("update candidate_applications set status='hired' where id=$1", [id(30)]); await asUser(db, 1);
      await db.query('select public.save_sales_referral_hire($1,1,$2,null,true)', [c.id, data.today]);
      await assert.rejects(db.query("select public.review_sales_referral_milestone($1,'30_days','approve',true,'verified')", [c.id]), /Not due/);
      await db.query("select public.disqualify_sales_referral($1,2,'Not a qualifying hire')", [c.id]);
      await assert.rejects(db.query("select public.review_sales_referral_milestone($1,'30_days','approve',true,'verified')", [c.id]), /Disqualified/);
    });
    await t.test('unconfirmed accounts cannot claim enrolled identities', async () => {
      await asUser(db, 1); await db.query("select public.save_sales_referral_employee(null,null,'Unverified','unverified@example.test','2020-01-01',null,true,true)");
      await asUser(db, 4); await assert.rejects(db.query('select public.read_my_sales_referral()'), /not enrolled/);
      assert.ok(employee);
    });
    await t.test('existing rep codes work without inventing an employee hire date', async () => {
      await asUser(db, 1);
      await db.query("select public.save_sales_referral_employee(null,null,'Current Sales Rep','current@example.test',null,null,true,true,'ORION-CJF')");
      const data = await getAdmin(); const e = data.employees.find(e => e.code === 'ORION-CJF');
      assert.equal(e.started_on, null); assert.equal(e.employment_verified_on, data.today);
      await asUser(db, null); assert.equal((await db.query('select public.validate_sales_referral($1,$2) valid', [e.code,id(10)])).rows[0].valid,true);
      await asUser(db, 1);
      await assert.rejects(db.query("select public.save_sales_referral_employee($1,1,'Current Sales Rep','current@example.test',null,null,true,true,'ORION-OTHER')",[e.id]), /codes cannot be changed/);
      await assert.rejects(db.query("select public.save_sales_referral_employee(null,null,'Duplicate','duplicate@example.test',null,null,true,true,'ORION-CJF')"), /unique constraint/);
    });
  } finally { await db.close(); }
});
