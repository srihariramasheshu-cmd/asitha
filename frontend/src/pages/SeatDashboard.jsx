import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FolderKanban, 
  Target, 
  CalendarClock,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  ArrowRight,
  Play
} from "lucide-react";
import { toast } from "sonner";

export default function SeatDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [todayTasks, setTodayTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        axios.get(`${API}/stats/overview`),
        axios.get(`${API}/tasks/today`)
      ]);
      setStats(statsRes.data);
      setTodayTasks(tasksRes.data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const markAsSent = async (taskId) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, {
        status: "sent",
        sent_timestamp: new Date().toISOString()
      });
      toast.success("Task marked as sent");
      fetchData();
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const statCards = [
    { 
      label: "My Projects", 
      value: stats?.total_projects || 0, 
      icon: FolderKanban, 
      path: "/projects"
    },
    { 
      label: "My Prospects", 
      value: stats?.total_prospects || 0, 
      icon: Target, 
      path: "/prospects"
    },
    { 
      label: "Today's Tasks", 
      value: todayTasks.filter(t => t.status === "pending").length, 
      icon: CalendarClock, 
      path: "/tasks"
    },
    { 
      label: "Emails Sent", 
      value: stats?.sent_tasks || 0, 
      icon: Send, 
      path: "/tasks"
    },
  ];

  if (loading) {
    return (
      <MainLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading dashboard...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={`Welcome, ${user?.name}`}
      subtitle="Your daily task queue and campaign overview"
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
              <div className="w-10 h-10 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                <stat.icon size={20} className="text-blue-500" strokeWidth={1.5} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Today's Task Queue */}
      <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-chivo font-bold text-xl text-white">Today's Task Queue</h3>
            <p className="font-mono text-xs text-zinc-500 mt-1">
              {todayTasks.filter(t => t.status === "pending").length} tasks remaining • {todayTasks.filter(t => t.status === "sent").length} completed
            </p>
          </div>
          <Button
            onClick={() => navigate("/tasks")}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            View All Tasks
            <ArrowRight size={14} className="ml-2" />
          </Button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <CheckCircle size={48} strokeWidth={1} className="mb-4 text-emerald-500" />
            <p className="font-manrope text-lg">No tasks scheduled for today</p>
            <p className="font-mono text-xs mt-2">Check back tomorrow or view all tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                data-testid={`task-${task.id}`}
                className={`task-card flex items-center justify-between ${task.status === "sent" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                    task.status === "sent" 
                      ? "bg-emerald-500/10 border border-emerald-500/20" 
                      : "bg-amber-500/10 border border-amber-500/20"
                  }`}>
                    {task.status === "sent" ? (
                      <CheckCircle size={18} className="text-emerald-500" />
                    ) : (
                      <Clock size={18} className="text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-sm text-zinc-300">
                      Prospect: {task.prospect_id.slice(0, 12)}...
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-[10px] text-zinc-500 uppercase">
                        Step {task.step_number}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {task.send_time}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs px-2 py-1 rounded-sm ${
                    task.status === "sent" ? "status-sent" : "status-pending"
                  }`}>
                    {task.status}
                  </span>
                  
                  {task.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/prospects/${task.prospect_id}`)}
                        className="text-zinc-400 hover:text-white"
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => markAsSent(task.id)}
                        data-testid={`mark-sent-${task.id}`}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
                      >
                        <Send size={14} className="mr-1" />
                        Mark Sent
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Send size={24} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Total Sent
              </p>
              <p className="font-chivo font-bold text-2xl text-white mt-1">
                {stats?.sent_tasks || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <MessageSquare size={24} className="text-violet-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Replies Received
              </p>
              <p className="font-chivo font-bold text-2xl text-white mt-1">
                {stats?.replied || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
