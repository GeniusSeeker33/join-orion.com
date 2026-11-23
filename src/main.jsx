import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import CareersPage from "./CareersPage.jsx";
import ReturnsAssessmentPage from "./ReturnsAssessmentPage.jsx";
import SalesExecutivePage from "./SalesExecutivePage.jsx";
import RecruitingDashboard from "./RecruitingDashboard.jsx";
import MarketingCommandCenter from "./MarketingCommandCenter.jsx";
import MarketingRoute from "./components/marketing/MarketingRoute.jsx";
import ATSWorkspace from "./ATSWorkspace.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/recruiting" element={<RecruitingDashboard />} />
        <Route path="/marketing/legacy/*" element={<MarketingCommandCenter />} />
        <Route path="/marketing/:section?/:campaignId?" element={<MarketingRoute />} />
        <Route path="/ats" element={<ATSWorkspace />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/returns-assessment" element={<ReturnsAssessmentPage />} />
        <Route path="/sales-executive" element={<SalesExecutivePage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>
);
