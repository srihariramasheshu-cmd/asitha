import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

const RANGE_TABS = [
  { key: "today", label: "Today", icon: CalendarClock, accent: "text-emerald-500" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, accent: "text-red-500" },
  { key: "week", label: "Next 7 Days", icon: Calendar, accent: "text-blue-500" },
  { key: "upcoming", label: "All Upcoming", icon: Repeat, accent: "text-zinc-400" },
];

export default function FollowupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = searchParams.get("range") || "today";
  const [range, setRange] = useState(
    RANGE_TABS.find((t) => t.key === initial) ? initial : "today"
  );
  const [team, setTeam] = useState([]);
  const [assignee, setAssignee] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { range_: range };
      if (assignee !== "all") params.assigned_to = assignee;
      const [r, t] = await Promise.all([
        axios.get(`${API}/crm/followups`, { params }),
        team.length ? Promise.resolve({ data: team }) : axios.get(`${API}/crm/team`),
      ]);
      setItems(r.data);
      if (!team.length) setTeam(t.data);
    } catch (e) {
      toast.error("Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const newParams = new URLSearchParams(searchParams);
    newParams.set("range", range);
    setSearchParams(newParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, assignee]);

  const complete = async (id) => {
    try {
      await axios.put(`${API}/crm/followups/${id}`, { status: "done" });
      toast.success("Done");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const skip = async (id) => {
    try {
      await axios.put(`${API}/crm/followups/${id}`, { status: "skipped" });
      toast.success("Skipped");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const groupByDate = items.reduce((acc, f) => {
    (acc[f.due_date] ||= []).push(f);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupByDate).sort();

  return (
    <MainLayout
      title="Follow-ups"
      subtitle={`${items.length} ${items.length === 1 ? "task" : "tasks"}`}
    >
      {/* Range tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGE_TABS.map((t) => (
          <Button
            key={t.key}
            variant={range === t.key ? "default" : "outline"}
            onClick={() => setRange(t.key)}
            data-testid={`range-${t.key}`}
            className={
              range === t.key
                ? "bg-zinc-800 text-white border border-zinc-700 rounded-sm"
                : "bg-transparent border-zinc-800 text-zinc-400 hover:text-white rounded-sm"
            }
          >
            <t.icon size={14} className={`mr-2 ${t.accent}`} />
            {t.label}
          </Button>
        ))}

        <div className="ml-auto">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-[220px] bg-zinc-900 border-zinc-800 rounded-sm">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all">All assignees</SelectItem>
              {team.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <p className="font-mono text-zinc-500">Loading…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <CheckCircle2
            size={48}
            className="mx-auto text-zinc-700 mb-4"
            strokeWidth={1}
          />
          <p className="font-manrope text-zinc-300 text-lg">All clear here.</p>
          <p className="font-mono text-xs text-zinc-500 mt-2">
            Nothing matches this filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-chivo font-bold text-sm text-white">
                  {date}
                </h2>
                <span className="font-mono text-[10px] text-zinc-500">
                  {groupByDate[date].length}{" "}
                  {groupByDate[date].length === 1 ? "task" : "tasks"}
                </span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>
              <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
                <div className="divide-y divide-zinc-800">
                  {groupByDate[date].map((f) => {
                    const overdue =
                      f.status === "pending" &&
                      f.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={f.id}
                        className={`px-4 py-3 flex items-center gap-3 ${
                          overdue ? "bg-red-500/5" : ""
                        }`}
                        data-testid={`fu-row-${f.id}`}
                      >
                        <div
                          className={`w-1 self-stretch rounded-sm ${
                            overdue ? "bg-red-500" : "bg-emerald-500"
                          }`}
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() =>
                            navigate(`/crm/responders/${f.responder_id}`)
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-manrope text-sm text-zinc-100 truncate">
                              {f.responder_name}
                            </span>
                            {f.responder_company && (
                              <span className="font-mono text-[11px] text-zinc-500 truncate">
                                · {f.responder_company}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-500 truncate">
                            {f.type.toUpperCase()} · {f.due_time}
                            {f.assigned_to_name && ` · ${f.assigned_to_name}`}
                            {f.notes && ` · ${f.notes}`}
                          </div>
                        </div>
                        {f.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => complete(f.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm h-8"
                              data-testid={`done-${f.id}`}
                            >
                              <CheckCircle2 size={14} className="mr-1" />
                              Done
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => skip(f.id)}
                              className="border-zinc-700 text-zinc-300 rounded-sm h-8"
                            >
                              <XCircle size={14} />
                            </Button>
                          </>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                            {f.status}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/crm/responders/${f.responder_id}`)
                          }
                          className="text-zinc-500 hover:text-white"
                        >
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
