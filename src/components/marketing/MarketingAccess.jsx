import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketingDevClient as supabase } from '../../lib/marketingDevClient';
import MarketingWorkspace from '../../pages/marketing/MarketingWorkspace';
import '../../styles/marketing.css';

// Authentication shares the existing site's session. RPCs enforce membership
// and role permissions independently; a signed-in user is not an administrator.
export default function MarketingAccess() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (active) { setSession(next); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || changed) return;
      setSession(data.session); setChecking(false);
      if (error) setMessage('Unable to check your session. Please try again.');
    }).catch(() => { if (active && !changed) { setChecking(false); setMessage('Unable to check your session. Please try again.'); } });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function login(event) {
    event.preventDefault(); setSending(true); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setPassword('');
      if (error) setMessage(error.message);
    } catch { setMessage('Unable to sign in. Please try again.'); }
    finally { setSending(false); }
  }
  return <div className="marketing-hub">
    {checking ? <p role="status">Checking your session…</p> : session?.user && !session.user.is_anonymous
      ? <MarketingWorkspace key={session.user.id} userId={session.user.id} />
      : <main className="marketing-login card">
        <Link to="/">← Back to Orion</Link>
        <h1>Marketing Hub</h1>
        <p>Sign in with your development administrator account. Access requires marketing workspace membership.</p>
        {!supabase ? <p role="alert">Sign-in is not configured.</p> : <form onSubmit={login}>
          <label className="form-field">Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="form-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="btn-primary" disabled={sending}>{sending ? 'Signing in…' : 'Sign in'}</button>
        </form>}
        {message && <p role="status">{message}</p>}
      </main>}
  </div>;
}
