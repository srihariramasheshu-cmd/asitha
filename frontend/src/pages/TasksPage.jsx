import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  CalendarClock, 
  Clock,
  CheckCircle,
  Send,
  MessageSquare,
  Search,
  Filter,
  CalendarIcon
} from "lucide-react";
import { toast } from "sonner";

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(null);
  
  // Reply modal state
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, dateFilter]);

  const fetchTasks = async () => {
    try {
      let url = `${API}/tasks?`;
      if (statusFilter) url += `status=${statusFilter}&`;
      if (dateFilter) url += `date=${format(dateFilter, 'yyyy-MM-dd')}&`;
      
      const res = await axios.get(url);
      setTasks(res.data);
    } catch (error) {
      toast.error("Failed to load tasks");
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
      fetchTasks();
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleLogReply = async () => {
    if (!replyContent.trim()) {
      toast.error("Please enter the reply content");
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API}/tasks/${selectedTask.id}`, {
        reply_content: replyContent
      });
      toast.success("Reply logged successfully");
      setShowReplyModal(false);
      setSelectedTask(null);
      setReplyContent("");
      fetchTasks();
    } catch (error) {
      toast.error("Failed to log reply");
    } finally {
      setSubmitting(false);
    }
  };

  const openReplyModal = (task) => {
    setSelectedTask(task);
    setShowReplyModal(true);
  };

  const filteredTasks = tasks.filter(t => 
    t.prospect_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case "sent": return <CheckCircle size={16} className="text-emerald-500" />;
      case "pending": return <Clock size={16} className="text-amber-500" />;
      default: return <Clock size={16} className="text-zinc-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "sent": return "status-sent";
      case "pending": return "status-pending";
      default: return "bg-zinc-800 text-zinc-400";
    }
  };

  if (loading) {
    return (
      <MainLayout title="Tasks">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading tasks...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={user?.role === "admin" ? "All Tasks" : "My Tasks"}
      subtitle={`${filteredTasks.length} tasks`}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <Input
            placeholder="Search by prospect ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-tasks"
            className="pl-10 bg-zinc-900 border-zinc-800 rounded-sm font-mono"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-[180px] justify-start bg-zinc-900 border-zinc-800 text-zinc-300"
            >
              <CalendarIcon size={16} className="mr-2" />
              {dateFilter ? format(dateFilter, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={setDateFilter}
              initialFocus
              className="bg-zinc-900"
            />
            {dateFilter && (
              <div className="p-2 border-t border-zinc-800">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDateFilter(null)}
                  className="w-full text-zinc-400"
                >
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <CalendarClock size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
          <p className="font-manrope text-zinc-400 text-lg">No tasks found</p>
          <p className="font-mono text-xs text-zinc-600 mt-2">
            {user?.role === "admin" 
              ? "Upload a schedule to create tasks" 
              : "You have no scheduled tasks"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              data-testid={`task-card-${task.id}`}
              className="bg-zinc-900/50 border border-white/5 rounded-sm p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
                    task.status === "sent" 
                      ? "bg-emerald-500/10 border border-emerald-500/20" 
                      : "bg-amber-500/10 border border-amber-500/20"
                  }`}>
                    {getStatusIcon(task.status)}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-white">
                        {task.prospect_id.slice(0, 12)}...
                      </span>
                      <span className="font-mono text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-sm">
                        Step {task.step_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-500">
                      <span className="font-mono text-xs flex items-center gap-1">
                        <CalendarIcon size={12} />
                        {task.send_date}
                      </span>
                      <span className="font-mono text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {task.send_time}
                      </span>
                      {task.sent_timestamp && (
                        <span className="font-mono text-[10px] text-emerald-500">
                          Sent: {new Date(task.sent_timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs px-2 py-1 rounded-sm ${getStatusBadge(task.status)}`}>
                    {task.status}
                  </span>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/prospects/${task.prospect_id}`)}
                      className="text-zinc-400 hover:text-white"
                    >
                      View Prospect
                    </Button>
                    
                    {task.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => markAsSent(task.id)}
                        data-testid={`mark-sent-${task.id}`}
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
                      >
                        <Send size={14} className="mr-1" />
                        Mark Sent
                      </Button>
                    )}
                    
                    {task.status === "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReplyModal(task)}
                        data-testid={`log-reply-${task.id}`}
                        className="border-zinc-700 text-zinc-300"
                      >
                        <MessageSquare size={14} className="mr-1" />
                        Log Reply
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      <Dialog open={showReplyModal} onOpenChange={setShowReplyModal}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Log Reply
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <p className="font-mono text-xs text-zinc-400">
              Prospect: {selectedTask?.prospect_id.slice(0, 12)}... • Step {selectedTask?.step_number}
            </p>
            
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Reply Content
              </Label>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Paste or summarize the reply received..."
                className="bg-zinc-950 border-zinc-800 rounded-sm font-manrope min-h-[150px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowReplyModal(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogReply}
              disabled={submitting}
              data-testid="submit-reply-btn"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
            >
              {submitting ? "Saving..." : "Save Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
