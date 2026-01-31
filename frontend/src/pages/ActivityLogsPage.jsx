import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Activity, 
  Send,
  MessageSquare,
  Clock,
  User
} from "lucide-react";
import { toast } from "sonner";

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [seatFilter, setSeatFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, [projectFilter]);

  const fetchData = async () => {
    try {
      let url = `${API}/activity-logs`;
      if (projectFilter && projectFilter !== "all") {
        url += `?project_id=${projectFilter}`;
      }
      
      const [logsRes, projectsRes, seatsRes] = await Promise.all([
        axios.get(url),
        axios.get(`${API}/projects`),
        axios.get(`${API}/users/seats`)
      ]);
      
      setLogs(logsRes.data);
      setProjects(projectsRes.data);
      setSeats(seatsRes.data);
    } catch (error) {
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "sent": return <Send size={14} className="text-emerald-500" />;
      case "reply_received": return <MessageSquare size={14} className="text-blue-500" />;
      default: return <Activity size={14} className="text-zinc-500" />;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "sent": return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Sent</Badge>;
      case "reply_received": return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">Reply</Badge>;
      default: return <Badge>{action}</Badge>;
    }
  };

  const getSeatName = (seatId) => {
    const seat = seats.find(s => s.id === seatId);
    return seat ? seat.name : seatId.slice(0, 8) + "...";
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : projectId.slice(0, 8) + "...";
  };

  const filteredLogs = logs.filter(log => {
    if (seatFilter !== "all" && log.seat_id !== seatFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <MainLayout title="Activity Logs">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading activity logs...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Activity Logs"
      subtitle={`${filteredLogs.length} activities recorded`}
    >
      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={seatFilter} onValueChange={setSeatFilter}>
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="All Seats" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Seats</SelectItem>
            {seats.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Activity Table */}
      {filteredLogs.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <Activity size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
          <p className="font-manrope text-zinc-400 text-lg">No activity recorded yet</p>
          <p className="font-mono text-xs text-zinc-600 mt-2">
            Activity will appear here when seats send emails or receive replies
          </p>
        </Card>
      ) : (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-zinc-500" />
                      <span className="font-mono text-xs text-zinc-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-zinc-500" />
                      <span className="font-manrope text-sm text-zinc-300">
                        {getSeatName(log.seat_id)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">
                    {getProjectName(log.project_id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      {getActionBadge(log.action)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">
                    {log.prospect_id.slice(0, 12)}...
                  </TableCell>
                  <TableCell>
                    {log.action === "sent" && log.details?.sent_timestamp && (
                      <span className="font-mono text-xs text-zinc-500">
                        at {new Date(log.details.sent_timestamp).toLocaleTimeString()}
                      </span>
                    )}
                    {log.action === "reply_received" && log.details?.reply_content && (
                      <span className="font-mono text-xs text-zinc-500 truncate max-w-[200px] block">
                        "{log.details.reply_content.slice(0, 50)}..."
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </MainLayout>
  );
}
