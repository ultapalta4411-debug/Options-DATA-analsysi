import React, { useState, useEffect } from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import OptionChainPage from './pages/OptionChainPage.jsx';
import PCRIVPage from './pages/PCRIVPage.jsx';
import GreeksPage from './pages/GreeksPage.jsx';
import SignalsPage from './pages/SignalsPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ImportExportPage from './pages/ImportExportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { Toaster } from '@/components/ui/sonner';

function OAuthCallbackHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userId = params.get('userId');
    const expiresAt = params.get('expiresAt');

    if (token && userId) {
      localStorage.setItem('angelOneUserId', userId);
      localStorage.setItem('angelOneToken', token);
      if (expiresAt) {
         localStorage.setItem('angelOneExpiresAt', expiresAt);
      }
      
      // Clean URL to prevent accidental token sharing and refresh issues
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  return null;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router>
      <OAuthCallbackHandler />
      <AuthProvider>
        <ScrollToTop />
        <div className="min-h-screen bg-background">
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          
          <Routes>
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
            
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex">
                    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                    <main className="flex-1 lg:ml-64 mt-[57px] min-h-[calc(100vh-57px)]">
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/option-chain" element={<OptionChainPage />} />
                        <Route path="/pcr-iv" element={<PCRIVPage />} />
                        <Route path="/greeks" element={<GreeksPage />} />
                        <Route path="/signals" element={<SignalsPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="/import-export" element={<ImportExportPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;