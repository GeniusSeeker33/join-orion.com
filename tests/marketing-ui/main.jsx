import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MarketingWorkspace from '../../src/pages/marketing/MarketingWorkspace';
import '../../src/index.css';
import '../../src/styles/marketing.css';
const path = new URLSearchParams(window.location.search).get('path') || '/marketing/campaigns';
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[path]}><div className="marketing-hub"><div role="note">SYNTHETIC LOCAL TEST — no hosted data</div><Routes><Route path="/marketing/:section?/:campaignId?" element={<MarketingWorkspace userId={`00000000-0000-4000-8000-${(new URLSearchParams(window.location.search).get("user") || "1").padStart(12, "0")}`} />} /></Routes></div></MemoryRouter>);
