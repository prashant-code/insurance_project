import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx'; 

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-semibold">Loading Enterprise Security context...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 font-sans antialiased">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
