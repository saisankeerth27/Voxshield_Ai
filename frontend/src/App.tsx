import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyzePage from "./pages/AnalyzePage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import AnalysisDetailsPage from "./pages/AnalysisDetailsPage";
import ReportPage from "./pages/ReportPage";

/**
 * Application routes.
 *
 * No authentication: the application opens directly. Routes:
 *   /           Landing
 *   /dashboard  Dashboard
 *   /analyze    Analysis workspace
 *   /history    Detection history
 *   /profile    Voice profile
 *   /analysis/:analysisId             Analysis details page
 *   /analysis/:analysisId/report      Printable report (standalone)
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/analysis/:analysisId" element={<AnalysisDetailsPage />} />
        </Route>
        <Route path="/analysis/:analysisId/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}