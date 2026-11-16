export const referralChannels = ['facebook', 'linkedin', 'instagram', 'email', 'other'];

export function referralLink(code, channel = 'other', origin = 'https://join-orion.com') {
  const url = new URL('/sales-executive', origin);
  url.search = new URLSearchParams({ ref: code, utm_source: channel, utm_medium: channel === 'email' ? 'email' : 'employee_referral', utm_campaign: 'sales_employee_referrals' }).toString();
  return url.href;
}

export function referralCopy(url) {
  return `I work at Orion Wholesale, and we're growing our Sales team! Explore our Sales Executive opportunity and apply using my referral link: ${url}\n\nI may receive an employee referral bonus if you join and meet the program milestones.`;
}

export function payrollCsv(data) {
  const cell = value => {
    let s = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows = [['Claim ID', 'Employee', 'Employee email', 'Candidate', 'Milestone', 'Due date', 'Amount USD', 'Approved at', 'Approval note']];
  for (const m of data.milestones.filter(m => m.state === 'approved' && m.eligibility === 'Ready for verification')) {
    const c = data.claims.find(c => c.id === m.claim_id);
    const e = data.employees.find(e => e.id === c.employee_id);
    rows.push([c.id, e.name, e.email, c.candidate_name, m.milestone, m.due_on, m.amount, m.approved_at, m.approval_note]);
  }
  return rows.map(row => row.map(cell).join(',')).join('\r\n');
}
