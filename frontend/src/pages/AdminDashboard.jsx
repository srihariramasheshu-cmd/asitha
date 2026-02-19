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
  CheckCircle
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
    </MainLayout>
  );
}
