import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { referralChannels, referralCopy, referralLink } from '../../lib/referrals';

export default function EmployeeReferrals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState('facebook');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    supabase.rpc('read_my_sales_referral').then(({ data, error }) => { if (live) { setData(data); if (error) setError(error.message); } });
    return () => { live = false; };
  }, []);
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setNotice('Copied to clipboard.'); }
    catch { setNotice('Copy is unavailable in this browser. Select and copy the text below.'); }
  }
  if (error) return <section className="ref-card" role="alert"><h1>Referral access unavailable</h1><p>{error}</p><p>Ask your administrator to enroll your work email in the Sales roster.</p></section>;
  if (!data) return <p role="status">Loading your referral link…</p>;
  const url = referralLink(data.employee.code, channel);
  const copyText = referralCopy(url);
  return <>
    <section className="ref-hero"><p className="ref-eyebrow">Exclusively for the Sales team</p><h1>Good people know<br />good people.</h1><p>{data.employee.name}, help someone grow with Orion. Share your personal link and earn up to <strong>$1,000</strong> for a qualifying Sales Consultant hire.</p></section>
    <div className="ref-stats" aria-label="Your referral totals"><div><strong>{data.application_count}</strong>Attributed applications</div><div><strong>{data.hired_count}</strong>Qualifying hires recorded</div><div><strong>${data.paid_total.toLocaleString()}</strong>Payments recorded</div></div>
    <div className="ref-grid"><section className="ref-card"><p className="ref-eyebrow">Your invitation</p><h2>Share the opportunity</h2>
      <label>Your referral code<input readOnly value={data.employee.code} /></label><button onClick={() => copy(data.employee.code)}>Copy code</button>
      <label>Where are you sharing?<select value={channel} onChange={e => setChannel(e.target.value)}>{referralChannels.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></label>
      <label>Your personal link<textarea readOnly rows={3} value={url} /></label><button className="ref-primary" onClick={() => copy(url)}>Copy referral link</button>
      <label>Suggested message<textarea readOnly rows={7} value={copyText} /></label>
      <div className="ref-actions"><button onClick={() => copy(copyText)}>Copy message</button>
        <a href={`mailto:?subject=${encodeURIComponent('Grow with Orion — Sales careers')}&body=${encodeURIComponent(referralCopy(referralLink(data.employee.code, 'email')))}`}>Open email draft</a>
        <a target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink(data.employee.code, 'facebook'))}`}>Share on Facebook</a>
        <a target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink(data.employee.code, 'linkedin'))}`}>Share on LinkedIn</a>
      </div><p className="ref-muted">For Instagram, put your referral link in your bio or send it by direct message. Include the link alongside the flyer so your code reaches the application.</p>
      {notice && <p role="status">{notice}</p>}
    </section><section className="ref-card"><img className="ref-flyer" src="/sales-referral-flyer.png" alt="Grow with Orion — Now hiring Sales Executives" /><a className="ref-download" href="/sales-referral-flyer.png" download="Orion-sales-careers.png">Download the recruiting flyer</a></section></div>
    <section className="ref-card"><h2>How your referral bonus works</h2><div className="ref-stats"><div><strong>$250</strong>30 days after hire</div><div><strong>$250</strong>6 months after hire</div><div><strong>$500</strong>12 months after hire</div></div>
      <p>Only enrolled Sales employees qualify. The new hire must be a Sales Consultant. Both employees must still be employed at every milestone and when payroll payment is recorded. Six and twelve months are calendar anniversaries of the hire date.</p>
      <p>The first valid code submitted with an application receives credit. Credit cannot be changed afterward; repeat applications with the same email do not create another bonus. Self-referrals do not qualify.</p>
      <p>An administrator verifies employment and approves each milestone for payroll. Totals here reflect recorded activity; reaching a date does not automatically issue a payment.</p>
    </section>
  </>;
}
