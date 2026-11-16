import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import EmployeeReferrals from './EmployeeReferrals';
import ReferralAdmin from './ReferralAdmin';
import './referrals.css';

export default function ReferralRoute({ admin = false }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => { if (live) { setSession(data?.session || null); if (error) setMessage(error.message); } });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { if (live) setSession(value); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  async function login(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = sent
        ? await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })
        : await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${admin ? '/admin/referrals' : '/referrals'}` } });
      if (result.error) throw result.error;
      setSent(true); setMessage(sent ? 'Signed in.' : 'Check your email for a sign-in link or verification code.');
    } catch (error) { setMessage(error.message || 'Sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="referrals"><div className="ref-shell">
    <header className="ref-header"><Link to="/referrals"><img src="/orion-logo-white.png" alt="Orion Wholesale" /></Link><nav aria-label="Referral navigation">
      <Link to="/sales-executive">Sales careers</Link>{admin && <Link to="/admin/recruiting">Recruiting</Link>}
      {session && <button onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage(error.message); }}>Sign out</button>}
    </nav></header>
    {!supabase ? <p role="alert">The referral program is not configured. Contact your administrator.</p> : session === undefined ? <p role="status">Loading your account…</p> : !session ? <section className="ref-card ref-login">
      <p className="ref-eyebrow">Orion Sales team</p><h1>{admin ? 'Referral administration' : 'Grow the team. Share the opportunity.'}</h1>
      <p>Sign in with your {admin ? 'administrator' : 'enrolled employee'} email. Sales employees can earn up to $1,000 for each qualifying new consultant.</p>
      <form onSubmit={login}><label>Work email<input type="email" autoComplete="email" required value={email} disabled={sent} onChange={e => setEmail(e.target.value)} /></label>
        {sent && <label>Verification code<input autoComplete="one-time-code" inputMode="numeric" required value={token} onChange={e => setToken(e.target.value)} /></label>}
        <button className="ref-primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code' : 'Send sign-in email'}</button>
        {sent && <button type="button" onClick={() => { setSent(false); setToken(''); }}>Use another email or resend</button>}
      </form>
    </section> : admin ? <ReferralAdmin key={session.user.id} /> : <EmployeeReferrals key={session.user.id} />}
    {message && <p role="status">{message}</p>}
    <footer>Sales employee referral program · $250 at 30 days · $250 at 6 months · $500 at 12 months</footer>
  </div></main>;
}
