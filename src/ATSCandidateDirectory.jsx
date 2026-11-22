import React, { useMemo, useState } from 'react';

/**
 * Development-only ATS directory.
 * No production data is fetched or modified. Pass verified, access-controlled
 * candidates and interviews from an authenticated ATS API when available.
 */
export default function ATSCandidateDirectory({ candidates = [], interviews = [], onSelectCandidate }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const filtered = useMemo(() => candidates.filter(candidate =>
    [candidate.full_name, candidate.email, candidate.phone].filter(Boolean)
      .some(value => value.toLowerCase().includes(query.trim().toLowerCase()))
  ), [candidates, query]);
  const selected = candidates.find(candidate => candidate.id === selectedId);
  const history = interviews.filter(interview => interview.candidate_id === selectedId);
  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <header><h1>Candidate Directory</h1><p>Development preview · Interview history and review workspace</p></header>
      <label htmlFor="candidate-search">Search candidates</label>
      <input id="candidate-search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Name, email, or phone" style={{ display: 'block', padding: 12, width: '100%', margin: '0.5rem 0 1rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(320px, 2fr)', gap: 24 }}>
        <section aria-label="Candidate results">
          <p>{filtered.length} candidates</p>
          {filtered.map(candidate => <button key={candidate.id} type="button"
            onClick={() => { setSelectedId(candidate.id); onSelectCandidate?.(candidate); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8 }}>
            <strong>{candidate.full_name}</strong><br />
            <small>{candidate.email || 'Email unavailable'} · {candidate.identity_review || 'Review pending'}</small>
          </button>)}
        </section>
        <section aria-label="Candidate profile">
          {!selected ? <p>Select a candidate to view their interview history.</p> : <>
            <h2>{selected.full_name}</h2>
            <p>{selected.email || 'No email'} · {selected.phone || 'No phone'}</p>
            <p>Identity review: {selected.identity_review || 'Pending'} · Future consideration: {selected.future_consideration || 'Unreviewed'}</p>
            <h3>Interview history</h3>
            {history.length === 0 && <p>No interviews linked.</p>}
            {history.map(interview => <article key={interview.id} style={{ borderTop: '1px solid #ccc', padding: '12px 0' }}>
              <strong>{interview.position_title}</strong>
              <p>{interview.scheduled_at || 'Date unavailable'} · {interview.stage || 'Stage unavailable'} · {interview.format || 'Format unavailable'}</p>
              <small>Attendance: {interview.attendance_status || 'Unverified'}</small>
              <p>Interview notes, manager feedback, ratings, and resume uploads will be enabled only after authenticated roles and private storage are configured.</p>
            </article>)}
          </>}
        </section>
      </div>
    </main>
  );
}
