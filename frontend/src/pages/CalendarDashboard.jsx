import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths } from "date-fns";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { 
  Send, 
  User, 
  Building, 
  Mail,
  Clock,
  CheckCircle,
  X,
  MessageSquare,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

export default function CalendarDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  
  // Task panel state
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [marking, setMarking] = useState(false);
  
  // Mark as Sent modal state
  const [showSentModal, setShowSentModal] = useState(false);
  const [sentEmailContent, setSentEmailContent] = useState("");
  
  // Notes state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchCalendarTasks();
  }, [currentDate, selectedProject, view]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/projects`);
      setProjects(res.data);
    } catch (error) {
      console.error("Failed to load projects");
    }
  };

  const fetchCalendarTasks = async () => {
    setLoading(true);
    try {
      // Calculate date range based on view
      let start, end;
      if (view === "month") {
        start = startOfMonth(currentDate);
        end = endOfMonth(addMonths(currentDate, 1));
      } else {
        start = startOfWeek(currentDate);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
      }

      let url = `${API}/tasks/calendar?start_date=${format(start, 'yyyy-MM-dd')}&end_date=${format(end, 'yyyy-MM-dd')}`;
      if (selectedProject !== "all") {
        url += `&project_id=${selectedProject}`;
      }

      const res = await axios.get(url);
      
      // Convert tasks to calendar events
      const calendarEvents = res.data.map(task => {
        const [hours, minutes] = task.send_time.split(':').map(Number);
        const startDate = new Date(task.send_date);
        startDate.setHours(hours, minutes, 0);
        
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + 30);

        return {
          id: task.id,
          title: task.prospect_company || task.step_label || `Step ${task.step_number}`,
          start: startDate,
          end: endDate,
          resource: task,
        };
      });

      setEvents(calendarEvents);
    } catch (error) {
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedTask(event.resource);
    setShowTaskPanel(true);
  };

  const handleEventDrop = async ({ event, start }) => {
    try {
      const newDate = format(start, 'yyyy-MM-dd');
      const newTime = format(start, 'HH:mm');
      
      await axios.put(`${API}/tasks/${event.id}`, {
        send_date: newDate,
        send_time: newTime
      });
      
      toast.success("Task rescheduled");
      fetchCalendarTasks();
    } catch (error) {
      toast.error("Failed to reschedule task");
    }
  };

  const handleMarkAsSent = async () => {
    if (!selectedTask) return;
    setMarking(true);
    try {
      await axios.put(`${API}/tasks/${selectedTask.id}`, {
        status: "sent",
        sent_timestamp: new Date().toISOString()
      });
      toast.success("Task marked as sent!");
      setShowTaskPanel(false);
      setSelectedTask(null);
      fetchCalendarTasks();
    } catch (error) {
      toast.error("Failed to update task");
    } finally {
      setMarking(false);
    }
  };

  const getEventStyle = (event) => {
    const task = event.resource;
    let backgroundColor = "#3B82F6"; // Blue for intro
    let borderColor = "#2563EB";
    
    if (task.status === "sent") {
      backgroundColor = "#10B981"; // Green for sent
      borderColor = "#059669";
    } else if (task.step_number > 1) {
      backgroundColor = "#8B5CF6"; // Purple for follow-ups
      borderColor = "#7C3AED";
    }
    
    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: "4px",
        border: `2px solid ${borderColor}`,
        color: "white",
        fontSize: "12px",
        fontFamily: "'JetBrains Mono', monospace",
      }
    };
  };

  const CustomToolbar = ({ onNavigate, label }) => (
    <div className="flex items-center justify-between mb-4 px-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="border-zinc-700 text-zinc-300"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
          className="border-zinc-700 text-zinc-300"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="border-zinc-700 text-zinc-300"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      
      <h2 className="font-chivo font-bold text-xl text-white">{label}</h2>
      
      <div className="flex items-center gap-2">
        <Button
          variant={view === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("month")}
          className={view === "month" ? "bg-blue-600" : "border-zinc-700 text-zinc-300"}
        >
          Month
        </Button>
        <Button
          variant={view === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("week")}
          className={view === "week" ? "bg-blue-600" : "border-zinc-700 text-zinc-300"}
        >
          Week
        </Button>
      </div>
    </div>
  );

  return (
    <MainLayout 
      title="My Calendar"
      subtitle="Click tasks to open • Drag to reschedule"
      actions={
        <Select value={selectedProject} onValueChange={setSelectedProject}>
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
      }
    >
      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-blue-500" />
          <span className="font-mono text-xs text-zinc-400">Intro Email</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-violet-500" />
          <span className="font-mono text-xs text-zinc-400">Follow-up</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-emerald-500" />
          <span className="font-mono text-xs text-zinc-400">Sent</span>
        </div>
      </div>

      {/* Calendar */}
      <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-4">
        <style>{`
          .rbc-calendar {
            background: transparent;
            font-family: 'Manrope', sans-serif;
          }
          .rbc-header {
            background: #18181B;
            border-color: #27272A !important;
            color: #71717a;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            padding: 10px 0;
          }
          .rbc-month-view, .rbc-time-view {
            border-color: #27272A;
          }
          .rbc-day-bg {
            background: #09090B;
          }
          .rbc-off-range-bg {
            background: #0a0a0c;
          }
          .rbc-today {
            background: rgba(59, 130, 246, 0.1) !important;
          }
          .rbc-date-cell {
            color: #a1a1aa;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            padding: 4px 8px;
          }
          .rbc-date-cell.rbc-now {
            color: #3B82F6;
            font-weight: bold;
          }
          .rbc-month-row {
            border-color: #27272A;
          }
          .rbc-day-slot .rbc-time-slot {
            border-color: #27272A;
          }
          .rbc-timeslot-group {
            border-color: #27272A;
          }
          .rbc-time-header-content {
            border-color: #27272A;
          }
          .rbc-time-content {
            border-color: #27272A;
          }
          .rbc-time-gutter .rbc-timeslot-group {
            color: #71717a;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
          }
          .rbc-event {
            cursor: pointer;
          }
          .rbc-event:hover {
            opacity: 0.9;
            transform: scale(1.02);
          }
          .rbc-show-more {
            color: #3B82F6;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
          }
        `}</style>
        
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          draggableAccessor={() => true}
          eventPropGetter={getEventStyle}
          components={{
            toolbar: CustomToolbar
          }}
          popup
          selectable
        />
      </Card>

      {/* Task Work Panel */}
      <Dialog open={showTaskPanel} onOpenChange={setShowTaskPanel}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white flex items-center gap-3">
              {selectedTask?.status === "sent" ? (
                <CheckCircle className="text-emerald-500" size={24} />
              ) : selectedTask?.step_number === 1 ? (
                <Mail className="text-blue-500" size={24} />
              ) : (
                <MessageSquare className="text-violet-500" size={24} />
              )}
              {selectedTask?.step_label || `Step ${selectedTask?.step_number}`}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4 mt-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={selectedTask.status === "sent" 
                  ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/30"
                  : "bg-amber-600/20 text-amber-400 border-amber-600/30"
                }>
                  {selectedTask.status === "sent" ? "Sent" : "Pending"}
                </Badge>
                <span className="font-mono text-xs text-zinc-500">
                  {selectedTask.send_date} at {selectedTask.send_time}
                </span>
              </div>

              {/* Prospect Info */}
              {selectedTask.prospect_id && (
                <Card className="bg-zinc-800/50 border border-zinc-700 p-4 space-y-3">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Prospect Details
                  </h4>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
                      <Building size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-manrope font-bold text-white">
                        {selectedTask.prospect_company || "No company"}
                      </p>
                      <p className="font-mono text-xs text-zinc-400">
                        {selectedTask.prospect_name || "No contact"}
                      </p>
                    </div>
                  </div>

                  {selectedTask.prospect_email && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Mail size={14} />
                      <span className="font-mono text-sm">{selectedTask.prospect_email}</span>
                    </div>
                  )}
                </Card>
              )}

              {/* Project Info */}
              <div className="flex items-center gap-2 text-zinc-400">
                <CalendarIcon size={14} />
                <span className="font-mono text-xs">
                  Project: {selectedTask.project_name || selectedTask.project_id?.slice(0, 8)}
                </span>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div className="bg-zinc-800/30 rounded-sm p-3 border border-zinc-800">
                  <p className="font-manrope text-sm text-zinc-300">
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Sent timestamp */}
              {selectedTask.sent_timestamp && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={14} />
                  <span className="font-mono text-xs">
                    Sent: {new Date(selectedTask.sent_timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowTaskPanel(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Close
            </Button>
            {selectedTask?.status !== "sent" && (
              <Button
                onClick={handleMarkAsSent}
                disabled={marking}
                data-testid="mark-sent-btn"
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
              >
                {marking ? (
                  <span>Marking...</span>
                ) : (
                  <>
                    <Send size={16} className="mr-2" />
                    Mark as Sent
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
