import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { payrollCsv, referralLink } from '../../lib/referrals';

const money = n => `$${n.toLocaleString()}`;
const milestoneNames = { '30_days': '30 days', '6_months': '6 months', '12_months': '12 months' };

export default function ReferralAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [employee, setEmployee] = useState(null);
  const [claimId, setClaimId] = useState('');
  const [payment, setPayment] = useState(null);
  const [dueOnly, setDueOnly] = useState(true);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('read_sales_referral_admin');
    if (error) throw error;
    setData(data);
  }, []);
  useEffect(() => { let live = true; supabase.rpc('read_sales_referral_admin').then(({ data, error }) => { if (live) { if (error) setError(error.message); else setData(data); } }); return () => { live = false; }; }, []);
  async function mutate(name, args, done) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const { error } = await supabase.rpc(name, args);
      if (error) throw error;
      done?.();
      await load(); setNotice('Saved. The referral ledger is up to date.');
    } catch (error) { setError(error.message || 'Unable to save. Refresh and try again.'); }
    finally { saving.current = false; setBusy(false); }
  }
  async function refresh() { setError(''); try { await load(); setEmployee(null); setPayment(null); } catch (error) { setError(error.message); } }
  function exportPayroll() {
    const blob = new Blob(['\uFEFF' + payrollCsv(data)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = `orion-referral-payroll-${data.today}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
    setNotice('Exported eligible approved milestones. Exporting does not mark them paid.');
  }
  const claim = data?.claims.find(c => c.id === claimId);
  return <>
    <section className="ref-hero"><p className="ref-eyebrow">Sales team growth</p><h1>Referral administration</h1><p>Enroll Sales employees, verify new hires, and track the three payroll milestones.</p></section>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!data ? !error && <p role="status">Loading the referral ledger…</p> : <>
      <div className="ref-actions"><button disabled={busy} onClick={refresh}>Refresh ledger</button><Link to="/referrals">Employee sharing page</Link><button disabled={busy || !data.milestones.some(m => m.state === 'approved' && m.eligibility === 'Ready for verification')} onClick={exportPayroll}>Export approved payroll CSV</button></div>
      <p className="ref-muted">Program date: {data.today} (Eastern time). Export files contain employee and candidate information; share only with authorized payroll staff.</p>
      {!data.jobs.length && <p role="alert">No eligible Sales job is enabled. Enable an active Sales Executive or Sales Consultant job in the referral program before launching.</p>}
      <div className="ref-stats"><div><strong>{data.employees.filter(e => e.sales_eligible && e.sharing_enabled && (!e.last_employed_on || e.last_employed_on >= data.today)).length}</strong>Employees sharing</div><div><strong>{data.claims.length}</strong>Attributed applicants</div><div><strong>{money(data.milestones.filter(m => m.state === 'paid').reduce((sum, m) => sum + m.amount, 0))}</strong>Payments recorded</div></div>
      <section className="ref-card"><h2>Sales employee roster</h2><p>Enroll each employee with their verified work email and employment start date if known. They can then sign in at <Link to="/referrals">/referrals</Link>. Keep employment dates current.</p>
        <button className="ref-primary" disabled={busy} onClick={() => setEmployee({})}>Enroll Sales employee</button>
        {employee && <EmployeeForm key={`${employee.id || 'new'}-${employee.revision || 0}`} employee={employee} busy={busy} today={data.today} onCancel={() => setEmployee(null)} onSave={args => mutate('save_sales_referral_employee', args, () => setEmployee(null))} />}
        <div className="ref-table-wrap"><table><thead><tr><th>Employee</th><th>Code / link</th><th>Employment</th><th>Access</th><th>Edit</th></tr></thead><tbody>{data.employees.map(e => <tr key={e.id}><td>{e.name}<br /><span className="ref-muted">{e.email}</span></td><td><a href={referralLink(e.code)} target="_blank" rel="noopener noreferrer">{e.code}</a></td><td>{e.started_on || `Verified active: ${e.employment_verified_on}`}<br />{e.last_employed_on ? `Last day: ${e.last_employed_on}` : 'Currently employed'}</td><td>{e.sales_eligible ? 'Sales eligible' : 'Ineligible'}<br />{e.sharing_enabled ? 'Sharing enabled' : 'Sharing paused'}</td><td><button disabled={busy} onClick={() => setEmployee(e)}>Edit {e.name}</button></td></tr>)}</tbody></table></div>
        {!data.employees.length && <p className="ref-muted">No employees enrolled yet. No employment dates are assumed from old sales rep records.</p>}
      </section>
      <section className="ref-card"><h2>Applications and hires</h2><p>The first valid code submitted receives credit. Mark a candidate Hired in <Link to="/admin/recruiting">Recruiting</Link>, then record their Sales Consultant start date here.</p>
        <div className="ref-table-wrap"><table><thead><tr><th>Candidate</th><th>Referrer</th><th>Application</th><th>Hire / last day</th><th>Review</th></tr></thead><tbody>{data.claims.map(c => <tr key={c.id}><td>{c.candidate_name}<br /><span className="ref-muted">{c.candidate_email}</span></td><td>{c.employee_name}<br /><code>{c.captured_code}</code></td><td>{c.candidate_status}<br />{c.captured_at.slice(0, 10)}</td><td>{c.void_reason ? `Disqualified: ${c.void_reason}` : c.hired_on || 'Not recorded'}{c.last_employed_on && <><br />Last day: {c.last_employed_on}</>}</td><td><button disabled={busy} onClick={() => { setClaimId(c.id); setPayment(null); }}>Review {c.candidate_name}</button></td></tr>)}</tbody></table></div>
        {!data.claims.length && <p className="ref-muted">Referrals appear here when candidates submit a valid code with their application.</p>}
        {claim && <HireForm key={`${claim.id}-${claim.revision}`} claim={claim} today={data.today} busy={busy} onClose={() => setClaimId('')} onSave={args => mutate('save_sales_referral_hire', args)} onDisqualify={args => mutate('disqualify_sales_referral', args)} />}
      </section>
      <section className="ref-card"><h2>Milestones and payroll</h2><p className="ref-banner">Verify both employees are still employed before approving each milestone and again when recording payment. This page records payroll payments; it does not transfer money.</p>
        <label><input type="checkbox" checked={dueOnly} onChange={e => setDueOnly(e.target.checked)} />Show unpaid milestones due now</label>
        <div className="ref-table-wrap"><table><thead><tr><th>Referral</th><th>Milestone</th><th>Due</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.milestones.filter(m => !dueOnly || (m.state !== 'paid' && m.due_on <= data.today)).map(m => {
          const c = data.claims.find(c => c.id === m.claim_id);
          const ready = m.eligibility === 'Ready for verification';
          const stale = m.eligibility === 'Employment changed; verify again';
          return <tr key={`${m.claim_id}-${m.milestone}`}><td>{c.employee_name}<br /><span className="ref-muted">Referred {c.candidate_name}</span></td><td>{milestoneNames[m.milestone]}</td><td>{m.due_on}</td><td>{money(m.amount)}</td><td><span className="ref-tag">{m.state}</span><br />{m.state === 'paid' ? `Payroll: ${m.payroll_reference}` : m.eligibility}</td><td>{m.state !== 'paid' && (ready || stale) && <button disabled={busy} onClick={() => setPayment({ ...m, action: m.state === 'approved' && ready ? 'paid' : 'approve', candidate: c.candidate_name, employee: c.employee_name })}>{m.state === 'approved' && ready ? 'Record payroll payment' : 'Verify employment'}</button>}</td></tr>;
        })}</tbody></table></div>
        {payment && <PaymentForm key={`${payment.claim_id}-${payment.milestone}-${payment.action}`} payment={payment} busy={busy} onCancel={() => setPayment(null)} onSave={args => mutate('review_sales_referral_milestone', args, () => setPayment(null))} />}
      </section>
      <section className="ref-card"><details><summary>Audit history — latest 200 events</summary><div className="ref-table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Record</th><th>Details</th></tr></thead><tbody>{data.audit.map(a => <tr key={a.id}><td>{a.occurred_at}</td><td>{a.action}</td><td><code>{a.actor || 'Applicant submission'}</code></td><td><code>{a.entity_id}</code></td><td><details><summary>View details</summary><pre className="ref-muted">{JSON.stringify(a.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div></details></section>
    </>}
  </>;
}

function EmployeeForm({ employee, today, busy, onSave, onCancel }) {
  const [verified, setVerified] = useState(false);
  return <form onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ p_id: employee.id || null, p_revision: employee.revision || null, p_name: f.get('name'), p_email: f.get('email'), p_started_on: f.get('start') || null, p_code: employee.code || f.get('code') || null, p_last_employed_on: f.get('end') || null, p_sales_eligible: f.has('sales'), p_sharing_enabled: f.has('sharing') }); }}>
    <h3>{employee.id ? 'Update employee' : 'Enroll employee'}</h3><div className="ref-form-grid">
      <label>Employee name<input name="name" required maxLength={160} defaultValue={employee.name || ''} /></label><label>Work email<input name="email" type="email" required maxLength={254} defaultValue={employee.email || ''} /></label>
      <label>Employment start date (if known)<input name="start" type="date" max={today} defaultValue={employee.started_on || ''} /></label><label>Last day employed (leave blank if current)<input name="end" type="date" defaultValue={employee.last_employed_on || ''} /></label>
    </div>{!employee.id && <label>Referral code (optional, e.g. ORION-CJF)<input name="code" pattern="ORION-[A-Z0-9]{2,24}" maxLength={30} placeholder="Leave blank to generate a code" /></label>}<p className="ref-muted">If the start date is unknown, enrollment records today as the date employment was verified. This does not set a hire date.</p><label><input type="checkbox" name="sales" defaultChecked={employee.sales_eligible ?? true} />Eligible Sales employee</label><label><input type="checkbox" name="sharing" defaultChecked={employee.sharing_enabled ?? true} />Enable referral sharing</label>
    <label><input type="checkbox" required checked={verified} onChange={e => setVerified(e.target.checked)} />I verified this employee’s identity, Sales eligibility, and employment dates.</label>
    <div className="ref-actions"><button className="ref-primary" disabled={busy || !verified}>Save employee</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}

function HireForm({ claim, today, busy, onSave, onClose, onDisqualify }) {
  return <div className="ref-card"><h3>Review {claim.candidate_name}</h3><p>{claim.position_title} · Referred by {claim.employee_name}</p>
    {claim.void_reason ? <p>Disqualified: {claim.void_reason}</p> : <>
      <form onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ p_claim: claim.id, p_revision: claim.revision, p_hired_on: f.get('hire'), p_last_employed_on: f.get('end') || null, p_sales_role_confirmed: f.has('verified') }); }}>
        <div className="ref-form-grid"><label>Consultant hire date<input name="hire" type="date" required max={today} defaultValue={claim.hired_on || ''} /></label><label>Consultant last day employed (blank if current)<input name="end" type="date" defaultValue={claim.last_employed_on || ''} /></label></div>
        <label><input name="verified" type="checkbox" required />I verified this Sales Consultant hire and their employment dates.</label><button className="ref-primary" disabled={busy || claim.candidate_status !== 'hired'}>Save verified hire</button>
        {claim.candidate_status !== 'hired' && <p className="ref-muted">Set the candidate’s status to Hired in Recruiting first.</p>}
      </form><details><summary>Disqualify this referral</summary><p>Stops future payments while preserving past payroll history. Attribution stays locked.</p><form onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); onDisqualify({ p_claim: claim.id, p_revision: claim.revision, p_reason: f.get('reason') }); }}><label>Disqualification reason<textarea name="reason" required maxLength={2000} /></label><label><input type="checkbox" required />I confirm this referral should be disqualified.</label><button disabled={busy}>Disqualify referral</button></form></details>
    </>}<button disabled={busy} onClick={onClose}>Close review</button>
  </div>;
}

function PaymentForm({ payment, busy, onSave, onCancel }) {
  const paid = payment.action === 'paid';
  return <form className="ref-card" onSubmit={event => { event.preventDefault(); const f = new FormData(event.currentTarget); onSave({ p_claim: payment.claim_id, p_milestone: payment.milestone, p_action: payment.action, p_both_employed: f.has('verified'), p_note: f.get('note') }); }}>
    <h3>{paid ? 'Record payroll payment' : 'Verify milestone'} — {money(payment.amount)}</h3><p>{payment.employee} referred {payment.candidate} · {milestoneNames[payment.milestone]} · Due {payment.due_on}</p>
    <label><input name="verified" type="checkbox" required />I verified both employees were employed at this milestone and are still employed today.</label>
    <label>{paid ? 'Payroll reference (completed payment)' : 'Employment verification note'}<textarea name="note" required maxLength={2000} /></label>
    {paid && <label><input type="checkbox" required />Payroll has completed this payment. I am recording it, not requesting a transfer.</label>}
    <div className="ref-actions"><button className="ref-primary" disabled={busy}>{paid ? 'Record completed payment' : 'Approve for payroll'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
