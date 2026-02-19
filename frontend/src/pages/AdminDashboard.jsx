import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  FolderKanban, 
  Users, 
  Target, 
  CalendarClock,
  Send,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Clock,
  UserCheck,
  Activity,
  Crown,
  Shield,
  Play,
  Square,
  FlaskConical,
  AlertCircle,
  CheckCircle,
  Download,
  Upload,
  FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Simulation state
  const [simulation, setSimulation] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [showSimReport, setShowSimReport] = useState(false);

  useEffect(() => {
    fetchData();
    checkSimulation();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, tasksRes, pendingRes] = await Promise.all([
        axios.get(`${API}/stats/overview`),
        axios.get(`${API}/tasks?status=pending`),
        axios.get(`${API}/users/pending`)
      ]);
      setStats(statsRes.data);
      setRecentTasks(tasksRes.data.slice(0, 5));
      setPendingUsers(pendingRes.data.slice(0, 5));
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const checkSimulation = async () => {
    try {
      const res = await axios.get(`${API}/simulation/status`);
      if (res.data.active) {
        setSimulation(res.data);
      } else {
        setSimulation(null);
      }
    } catch (error) {
      console.error("Failed to check simulation status");
    }
  };

  const startSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await axios.post(`${API}/simulation/start`);
      toast.success(res.data.message);
      setSimulation({
        active: true,
        simulation_id: res.data.simulation_id,
        data: res.data.data
      });
      setShowSimReport(true);
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start simulation");
    } finally {
      setSimLoading(false);
    }
  };

  const endSimulation = async () => {
    setSimLoading(true);
    try {
      await axios.post(`${API}/simulation/end`);
      toast.success("Simulation ended and data cleaned up!");
      setSimulation(null);
      setShowSimReport(false);
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to end simulation");
    } finally {
      setSimLoading(false);
    }
  };

  const statCards = [
    { 
      label: "Total Projects", 
      value: stats?.total_projects || 0, 
      icon: FolderKanban, 
      color: "blue",
      path: "/projects"
    },
    { 
      label: "Active Seats", 
      value: stats?.total_seats || 0, 
      icon: Users, 
      color: "emerald",
      path: "/admin/seats"
    },
    { 
      label: "Total Prospects", 
      value: stats?.total_prospects || 0, 
      icon: Target, 
      color: "amber",
      path: "/prospects"
    },
    { 
      label: "Pending Approvals", 
      value: stats?.pending_users || 0, 
      icon: UserCheck, 
      color: "violet",
      path: "/admin/users"
    },
  ];

  const activityCards = [
    { label: "Emails Sent", value: stats?.sent_tasks || 0, icon: Send, color: "emerald" },
    { label: "Replies Received", value: stats?.replied || 0, icon: MessageSquare, color: "blue" },
    { 
      label: "Response Rate", 
      value: stats?.sent_tasks ? `${((stats?.replied / stats?.sent_tasks) * 100).toFixed(1)}%` : "0%", 
      icon: TrendingUp, 
      color: "amber" 
    },
  ];

  if (loading) {
    return (
      <MainLayout title="Control Tower">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading dashboard...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Control Tower" 
      subtitle="Global campaign overview and management"
    >
      {/* Simulation Banner */}
      {simulation?.active && (
        <div className="mb-6 p-4 bg-amber-600/10 border border-amber-600/30 rounded-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-amber-600/20 border border-amber-600/30 flex items-center justify-center animate-pulse">
                <FlaskConical size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="font-chivo font-bold text-amber-400">Simulation Mode Active</p>
                <p className="font-mono text-xs text-amber-400/70">
                  Only simulation data is visible • Real data is hidden
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowSimReport(true)}
                variant="outline"
                size="sm"
                className="border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
              >
                View Details
              </Button>
              <Button
                onClick={endSimulation}
                disabled={simLoading}
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white"
                data-testid="end-simulation-btn"
              >
                <Square size={14} className="mr-2" />
                End Simulation
              </Button>
            </div>
          </div>
          {/* Quick Actions for Simulation */}
          <div className="flex items-center gap-3 pt-3 border-t border-amber-600/20">
            <a
              href={`${API}/simulation/sample-csv`}
              download="sample_prospects.csv"
              className="inline-flex items-center px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 rounded text-amber-400 text-sm font-mono"
            >
              <Download size={14} className="mr-2" />
              Download Sample CSV
            </a>
            <Button
              onClick={() => navigate("/prospects")}
              size="sm"
              variant="ghost"
              className="text-amber-400 hover:bg-amber-600/20"
            >
              <Upload size={14} className="mr-2" />
              Upload Prospects
            </Button>
            <Button
              onClick={() => navigate("/scheduling")}
              size="sm"
              variant="ghost"
              className="text-amber-400 hover:bg-amber-600/20"
            >
              <CalendarClock size={14} className="mr-2" />
              Schedule Tasks
            </Button>
            <Button
              onClick={() => navigate("/admin/task-management")}
              size="sm"
              variant="ghost"
              className="text-amber-400 hover:bg-amber-600/20"
            >
              <CheckCircle size={14} className="mr-2" />
              Manage Tasks
            </Button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => (
          <Card
            key={stat.label}
            onClick={() => navigate(stat.path)}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
            className={`card-hover cursor-pointer bg-zinc-900/50 border border-white/5 rounded-sm p-6 animate-fade-in animate-delay-${(index + 1) * 100}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  {stat.label}
                </p>
                <p className="font-chivo font-black text-4xl text-white mt-2">
                  {stat.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-sm bg-${stat.color}-600/10 border border-${stat.color}-600/20 flex items-center justify-center`}>
                <stat.icon size={20} className={`text-${stat.color}-500`} strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-4 text-zinc-500 hover:text-blue-400 transition-colors">
              <span className="font-mono text-xs">View details</span>
              <ArrowRight size={12} />
            </div>
          </Card>
        ))}
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {activityCards.map((stat) => (
          <Card
            key={stat.label}
            className="bg-zinc-900/50 border border-white/5 rounded-sm p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-sm bg-${stat.color}-600/10 border border-${stat.color}-600/20 flex items-center justify-center`}>
                <stat.icon size={24} className={`text-${stat.color}-500`} strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  {stat.label}
                </p>
                <p className="font-chivo font-bold text-2xl text-white mt-1">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <h3 className="font-chivo font-bold text-lg text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {/* Simulation Button */}
            {!simulation?.active && (
              <Button
                onClick={startSimulation}
                disabled={simLoading}
                data-testid="start-simulation-btn"
                className="w-full justify-start bg-amber-600 hover:bg-amber-500 text-white rounded-sm h-12 font-manrope btn-glow"
              >
                <FlaskConical size={18} className="mr-3" />
                {simLoading ? "Starting Simulation..." : "Run Test Simulation"}
              </Button>
            )}
            <Button
              onClick={() => navigate("/admin/users")}
              data-testid="quick-manage-users"
              className={`w-full justify-start rounded-sm h-12 font-manrope ${
                (stats?.pending_users || 0) > 0 
                  ? "bg-violet-600 hover:bg-violet-500 text-white btn-glow" 
                  : "bg-zinc-800 hover:bg-zinc-700 text-white"
              }`}
            >
              <UserCheck size={18} className="mr-3" />
              Manage Users {(stats?.pending_users || 0) > 0 && `(${stats.pending_users} pending)`}
            </Button>
            <Button
              onClick={() => navigate("/projects")}
              data-testid="quick-new-project"
              className="w-full justify-start bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm h-12 font-manrope"
            >
              <FolderKanban size={18} className="mr-3" />
              Create New Project
            </Button>
            <Button
              onClick={() => navigate("/admin/activity-logs")}
              data-testid="quick-activity-logs"
              className="w-full justify-start bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm h-12 font-manrope"
            >
              <Activity size={18} className="mr-3" />
              View Activity Logs
            </Button>
            <Button
              onClick={() => navigate("/admin/export")}
              data-testid="quick-export"
              className="w-full justify-start bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-12 font-manrope btn-glow"
            >
              <TrendingUp size={18} className="mr-3" />
              Export Activity Report
            </Button>
          </div>
        </Card>

        {/* Pending Users */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-chivo font-bold text-lg text-white">Pending Approvals</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/users")}
              className="text-zinc-400 hover:text-white"
            >
              View All
              <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          
          {pendingUsers.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-zinc-500 font-mono text-sm">
              No pending approvals
            </div>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map((pendingUser) => (
                <div
                  key={pendingUser.id}
                  className="task-card flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <UserCheck size={14} className="text-amber-500" />
                    </div>
                    <div>
                      <p className="font-manrope text-sm text-zinc-300">
                        {pendingUser.name}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {pendingUser.email}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Simulation Report Modal */}
      <Dialog open={showSimReport} onOpenChange={setShowSimReport}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-chivo text-white flex items-center gap-2">
              <FlaskConical size={20} className="text-amber-400" />
              Simulation Details
            </DialogTitle>
          </DialogHeader>
          
          {simulation?.data && (
            <div className="space-y-6 mt-4">
              {/* Instructions */}
              <div className="bg-blue-600/10 border border-blue-600/30 rounded-sm p-4">
                <p className="font-mono text-xs text-blue-400 font-bold mb-2">Simulation Workflow</p>
                <ol className="font-mono text-xs text-blue-400/80 space-y-1 list-decimal list-inside">
                  <li>Download sample CSV with prospect data</li>
                  <li>Upload prospects to the simulation project</li>
                  <li>Schedule prospects to create tasks</li>
                  <li>Manage tasks - add notes, change status</li>
                </ol>
              </div>

              {/* Download Sample CSV */}
              <a
                href={`${API}/simulation/sample-csv`}
                download="sample_prospects.csv"
                className="flex items-center justify-center gap-2 w-full p-3 bg-emerald-600 hover:bg-emerald-500 rounded-sm text-white font-bold"
              >
                <FileSpreadsheet size={18} />
                Download Sample Prospects CSV
              </a>

              {/* Project Info */}
              <div className="bg-zinc-800/30 rounded-sm p-4">
                <p className="font-mono text-xs text-zinc-500 mb-2 uppercase">Simulation Project</p>
                <p className="text-white font-chivo">{simulation.data.project_name}</p>
                <p className="font-mono text-xs text-zinc-400 mt-1">Mail Domain: {simulation.data.domain}</p>
              </div>

              {/* Seats */}
              <div>
                <p className="font-mono text-xs text-zinc-500 mb-3 uppercase">Simulated Seats (Login as any)</p>
                <div className="space-y-2">
                  {simulation.data.seats?.map((seat, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-sm">
                      <div>
                        <p className="text-white text-sm">{seat.name}</p>
                        <p className="font-mono text-xs text-zinc-500">{seat.email}</p>
                      </div>
                      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">
                        {seat.mail_id}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Login Info */}
              <div className="bg-amber-600/10 border border-amber-600/30 rounded-sm p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-mono text-xs text-amber-400 font-bold">Seat Login Password</p>
                    <p className="font-mono text-xs text-amber-400/70 mt-1">
                      All simulation seats use: <code className="bg-zinc-800 px-1 rounded">simpass123</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSimReport(false)} 
              className="border-zinc-700"
            >
              Close
            </Button>
            <Button
              onClick={() => { navigate("/prospects"); setShowSimReport(false); }}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              <Upload size={16} className="mr-2" />
              Upload Prospects
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
