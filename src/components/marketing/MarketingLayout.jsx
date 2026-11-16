import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function MarketingLayout({ title, children }) {
  const [error, setError] = useState('');
  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch { setError('Unable to sign out. Please try again.'); }
  }
  return <main className="marketing-main">
    <header className="marketing-header">
      <div><Link to="/">Orion Wholesale</Link><h1>{title}</h1></div>
      <nav aria-label="Administration" className="button-row">
        <Link className="btn-secondary" to="/admin">Dealer Admin</Link>
        <Link className="btn-secondary" to="/admin/recruiting">Recruiting</Link>
        <Link className="btn-secondary" to="/admin/referrals">Sales referrals</Link>
        <button className="btn-secondary" onClick={logout}>Sign out</button>
      </nav>
    </header>
    {error && <p role="alert">{error}</p>}
    <div className="page-content">{children}</div>
  </main>;
}
