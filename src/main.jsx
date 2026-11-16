import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import CareersPage from "./CareersPage.jsx";
import SalesExecutivePage from "./SalesExecutivePage.jsx";
import RecruitingDashboard from "./RecruitingDashboard.jsx";
import "./index.css";
import MarketingRoute from "./components/marketing/MarketingRoute.jsx";
const ReferralRoute = React.lazy(() => import('./components/referrals/ReferralRoute.jsx'));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/referrals" element={<React.Suspense fallback={<p>Loading referrals…</p>}><ReferralRoute /></React.Suspense>} />
        <Route path="/admin/referrals" element={<React.Suspense fallback={<p>Loading referrals…</p>}><ReferralRoute admin /></React.Suspense>} />
        <Route path="/" element={<App />} />
        <Route path="/marketing/:section?/:campaignId?" element={<MarketingRoute />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/recruiting" element={<RecruitingDashboard />} />
        <Route path="/ats" element={<RecruitingDashboard />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/sales-executive" element={<SalesExecutivePage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>
);
