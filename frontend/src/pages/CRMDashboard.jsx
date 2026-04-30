import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Repeat,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_BADGE, SOURCE_BADGE } from "@/lib/crmStyles";

export default function CRMDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, today, od, recentResp] = await Promise.all([
        axios.get(`${API}/crm/stats`),
        axios.get(`${API}/crm/followups`, { params: { range_: "today" } }),
        axios.get(`${API}/crm/followups`, { params: { range_: "overdue" } }),
        axios.get(`${API}/crm/responders`),
      ]);
      setStats(s.data);
      setTodayFollowups(today.data);
      setOverdue(od.data);
      setRecent(recentResp.data.slice(0, 6));
    } catch (e) {
      toast.error("Failed to load CRM dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completeFollowup = async (id) => {
    try {
      await axios.put(`${API}/crm/followups/${id}`, { status: "done" });
      toast.success("Marked as done");
      load();
    } catch (e) {
      toast.error("Failed to update follow-up");
    }
  };

  const cards = [
    {
      label: "Total Responders",
      value: stats?.total_responders ?? 0,
      icon: Inbox,
      color: "text-blue-500",
      onClick: () => navigate("/crm/responders"),
    },
    {
      label: "Due Today",
      value: stats?.followups_today ?? 0,
      icon: CalendarClock,
      color: "text-emerald-500",
      onClick: () => navigate("/crm/followups?range=today"),
    },
    {
      label: "Overdue",
      value: stats?.followups_overdue ?? 0,
      icon: AlertTriangle,
      color: "text-red-500",
      onClick: () => navigate("/crm/followups?range=overdue"),
    },
    {
      label: "Win Rate",
      value: `${stats?.win_rate ?? 0}%`,
      icon: TrendingUp,
      color: "text-purple-500",
    },
  ];

  if (loading) {
    return (
      <MainLayout title="Liberty CAD CRM">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading…</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Liberty CAD CRM"
      subtitle="Responders from Smartlead and HeyReach campaigns"
      actions={
        <Button
          data-testid="add-responder-btn"
          onClick={() => navigate("/crm/responders?new=1")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-bold"
        >
          <Plus size={18} className="mr-2" />
          Add Responder
        </Button>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card
            key={c.label}
            onClick={c.onClick}
            className={`bg-zinc-900/50 border border-white/5 rounded-sm p-5 ${
              c.onClick ? "cursor-pointer hover:border-zinc-700" : ""
            } transition-colors`}
            data-testid={`stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  {c.label}
                </p>
                <p className="font-chivo font-black text-3xl text-white mt-2">
                  {c.value}
                </p>
              </div>
              <c.icon size={22} className={c.color} strokeWidth={1.5} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's follow-ups */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-emerald-500" />
              <h2 className="font-chivo font-bold text-lg text-white">
                Today's Follow-ups
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/crm/followups")}
              className="text-zinc-400 hover:text-white"
            >
              View all
              <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>

          {todayFollowups.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2
                size={36}
                className="mx-auto text-zinc-700 mb-2"
                strokeWidth={1}
              />
              <p className="font-manrope text-sm text-zinc-500">
                Nothing due today. Inbox zero.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {todayFollowups.map((f) => (
                <div
                  key={f.id}
                  className="py-3 flex items-center gap-3"
                  data-testid={`today-followup-${f.id}`}
                >
                  <div className="w-1 self-stretch bg-emerald-500 rounded-sm" />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/crm/responders/${f.responder_id}`)}
                  >
                    <p className="font-manrope text-sm text-zinc-200 truncate">
                      {f.responder_name}
                      {f.responder_company && (
                        <span className="text-zinc-500"> · {f.responder_company}</span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500 truncate">
                      {f.type.toUpperCase()} · {f.due_time}
                      {f.notes ? ` · ${f.notes}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => completeFollowup(f.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
                    data-testid={`complete-${f.id}`}
                  >
                    Done
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Overdue */}
        <Card className="bg-zinc-900/50 border border-red-500/20 rounded-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-chivo font-bold text-lg text-white">Overdue</h2>
          </div>
          {overdue.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500">All caught up.</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {overdue.map((f) => (
                <div
                  key={f.id}
                  onClick={() => navigate(`/crm/responders/${f.responder_id}`)}
                  className="border border-red-500/20 bg-red-500/5 rounded-sm p-3 cursor-pointer hover:bg-red-500/10"
                >
                  <p className="font-manrope text-sm text-zinc-200 truncate">
                    {f.responder_name}
                  </p>
                  <p className="font-mono text-[11px] text-red-400">
                    Due {f.due_date} · {f.type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent responders */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-chivo font-bold text-lg text-white">
            Recent Responders
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/crm/responders")}
            className="text-zinc-400 hover:text-white"
          >
            View all
            <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>

        {recent.length === 0 ? (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-10 text-center">
            <Inbox size={36} className="mx-auto text-zinc-700 mb-3" strokeWidth={1} />
            <p className="font-manrope text-sm text-zinc-400">
              No responders yet. Add the first person who replied.
            </p>
            <Button
              onClick={() => navigate("/crm/responders?new=1")}
              className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
            >
              <Plus size={16} className="mr-2" />
              Add Responder
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((r) => (
              <Card
                key={r.id}
                onClick={() => navigate(`/crm/responders/${r.id}`)}
                className="bg-zinc-900/50 border border-white/5 rounded-sm p-4 cursor-pointer hover:border-zinc-700 transition-colors"
                data-testid={`responder-card-${r.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-manrope font-bold text-zinc-100 truncate">
                      {r.full_name}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500 truncate">
                      {r.company || "—"}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${SOURCE_BADGE[r.source] || ""}`}
                  >
                    {r.source}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span
                    className={`px-2 py-0.5 rounded-sm border ${STATUS_BADGE[r.status] || ""}`}
                  >
                    {r.status}
                  </span>
                  {r.next_followup_at && (
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Clock size={11} />
                      {r.next_followup_at}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
