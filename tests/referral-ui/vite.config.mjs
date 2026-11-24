import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createReferralDb, asUser, seedEmployee, id } from '../fixtures/referralDb.mjs';
const db = await createReferralDb();
await seedEmployee(db);
const signatures = {
  read_my_sales_referral: [], read_sales_referral_admin: [], validate_sales_referral: ['p_code','p_job'],
  save_sales_referral_employee: ['p_id','p_revision','p_name','p_email','p_started_on','p_last_employed_on','p_sales_eligible','p_sharing_enabled','p_code'],
  save_sales_referral_hire: ['p_claim','p_revision','p_hired_on','p_last_employed_on','p_sales_role_confirmed'],
  review_sales_referral_milestone: ['p_claim','p_milestone','p_action','p_both_employed','p_note'],
  disqualify_sales_referral: ['p_claim','p_revision','p_reason'],
};
let queue = Promise.resolve();
export default defineConfig({
  plugins: [react(), tailwindcss(), { name: 'synthetic-referral-db', configureServer(server) {
    server.middlewares.use('/__referral_test', (req,res) => {
      const execute = async () => {
        try {
          let raw = ''; for await (const chunk of req) raw += chunk;
          const { operation, name, args = {}, user } = JSON.parse(raw);
          let data;
          await asUser(db, user || null);
          if (operation === 'rpc' && name === 'read_screening_questionnaire') {
            data = null; // This harness has no published Sales questionnaire.
          } else if (operation === 'rpc') {
            const keys = signatures[name]; if (!keys) throw new Error('Unknown fixture RPC');
            data = (await db.query(`select public.${name}(${keys.map((_,i) => `$${i+1}`).join(',')}) data`, keys.map(k => args[k] ?? null))).rows[0].data;
          } else if (operation === 'jobs') {
            data = (await db.query('select * from public.job_postings')).rows.map(j => ({ ...j, location: 'Orion office', employment_type: 'Full time', description: 'Join our Sales team.', hours: 'Monday–Friday', pay: 'Salary and commission' }));
          } else if (operation === 'apply') {
            const a = args;
            await db.query('insert into candidate_applications values($1,$2,$3,$4,$5,$6,$7,$8)', [a.id,a.email,a.first_name,a.last_name,a.position_id,a.position_title,a.status,a.employee_referral_code || null]); data = null;
          } else if (operation === 'historical-hire') {
            // Test-only fixture: simulate a past application and an HR-verified hire.
            await db.exec('reset role');
            await db.query("update referrals.claims set captured_at='2024-01-01' where candidate_email=$1", [args.email]);
            await db.query("update candidate_applications set status='hired' where email=$1", [args.email]); data = true;
          } else throw new Error('Unknown fixture operation');
          res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ data, error: null }));
        } catch (error) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ data: null, error: { message:error.message, code:error.code } })); }
      };
      queue = queue.then(execute,execute);
    });
  } }],
  resolve: { alias: [{ find: /.*\/supabaseClient(?:\.js)?$/, replacement: fileURLToPath(new URL('./client.js', import.meta.url)) }] },
  server: { host:'127.0.0.1',port:5182,strictPort:true },
});
