import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import CareersPage from "./CareersPage.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/careers" element={<CareersPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>
);
