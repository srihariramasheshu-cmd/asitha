import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AdminDashboard from "@/pages/AdminDashboard";
import SeatDashboard from "@/pages/SeatDashboard";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import ProspectsPage from "@/pages/ProspectsPage";
import ProspectDetailPage from "@/pages/ProspectDetailPage";
import SeatsPage from "@/pages/SeatsPage";
import UsersManagementPage from "@/pages/UsersManagementPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import TasksPage from "@/pages/TasksPage";
import ScheduleUploadPage from "@/pages/ScheduleUploadPage";
import ExportPage from "@/pages/ExportPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Configure axios defaults
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      axios.get(`${API}/auth/me`)
        .then(res => {
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !["admin", "super_admin"].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 font-mono">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return ["admin", "super_admin"].includes(user.role) ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/seats" element={
        <ProtectedRoute adminOnly>
          <SeatsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly>
          <UsersManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/activity-logs" element={
        <ProtectedRoute adminOnly>
          <ActivityLogsPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/schedule" element={
        <ProtectedRoute adminOnly>
          <ScheduleUploadPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/export" element={
        <ProtectedRoute adminOnly>
          <ExportPage />
        </ProtectedRoute>
      } />
      
      {/* Shared Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <SeatDashboard />
        </ProtectedRoute>
      } />
      <Route path="/projects" element={
        <ProtectedRoute>
          <ProjectsPage />
        </ProtectedRoute>
      } />
      <Route path="/projects/:projectId" element={
        <ProtectedRoute>
          <ProjectDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/prospects" element={
        <ProtectedRoute>
          <ProspectsPage />
        </ProtectedRoute>
      } />
      <Route path="/prospects/:prospectId" element={
        <ProtectedRoute>
          <ProspectDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <TasksPage />
        </ProtectedRoute>
      } />
      
      {/* Default redirects */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-zinc-950">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
