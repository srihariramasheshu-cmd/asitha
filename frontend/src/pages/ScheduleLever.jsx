import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { format, addDays } from "date-fns";
import { 
  Zap, 
  CalendarIcon,
  Clock,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Target,
  Settings
} from "lucide-react";
import { toast } from "sonner";

export default function ScheduleLever() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [prospectsCount, setProspectsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  
  // Lever settings
  const [startDate, setStartDate] = useState(null);
  const [startTime, setStartTime] = useState("09:00");
  const [gapDays, setGapDays] = useState(3);
  const [mailsPerDomainPerDay, setMailsPerDomainPerDay] = useState(10);
  const [jitterMinutes, setJitterMinutes] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProspectsCount(selectedProject);
      // Set settings from project
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        setGapDays(project.gap_days || 3);
        setMailsPerDomainPerDay(project.mails_per_domain_per_day || 10);
        setJitterMinutes(project.jitter_minutes || 0);
      }
    }
  }, [selectedProject, projects]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/projects`);
      setProjects(res.data);
    } catch (error) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const fetchProspectsCount = async (projectId) => {
    try {
      const res = await axios.get(`${API}/prospects?project_id=${projectId}`);
      setProspectsCount(res.data.length);
    } catch (error) {
      setProspectsCount(0);
    }
  };

  const handleApplyLever = async () => {
    if (!selectedProject || !startDate) {
      toast.error("Please select a project and start date");
      return;
    }

    if (prospectsCount === 0) {
      toast.error("No prospects in this project to schedule");
      return;
    }

    setApplying(true);
    setResult(null);

    try {
      const res = await axios.post(`${API}/tasks/lever`, {
        project_id: selectedProject,
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: startTime
      });
      
      setResult(res.data);
      toast.success(`Generated ${res.data.tasks_count} tasks!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to apply schedule");
    } finally {
      setApplying(false);
    }
  };

  const updateProjectGap = async () => {
    if (!selectedProject) return;
    
    try {
      const project = projects.find(p => p.id === selectedProject);
      await axios.put(`${API}/projects/${selectedProject}`, {
        ...project,
        gap_days: gapDays
      });
      toast.success("Gap days updated");
      fetchProjects();
    } catch (error) {
      toast.error("Failed to update gap days");
    }
  };

  // Preview dates
  const getPreviewDates = () => {
    if (!startDate) return [];
    const dates = [];
    for (let i = 0; i < 5; i++) {
      dates.push(addDays(startDate, i * gapDays));
    }
    return dates;
  };

  const previewDates = getPreviewDates();

  if (loading) {
    return (
      <MainLayout title="Schedule Lever">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Schedule Lever"
      subtitle="Auto-generate 5-step sequences for all prospects"
    >
      <div className="max-w-4xl">
        {/* Main Control Panel */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Zap size={24} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-chivo font-bold text-lg text-white">The Lever</h3>
              <p className="font-mono text-xs text-zinc-500">
                Set intro date + gap → Generate all follow-ups automatically
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Select Project
              </Label>
              <Select value={selectedProject || "select"} onValueChange={(val) => setSelectedProject(val === "select" ? null : val)}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm h-12">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="select" disabled>Choose a project...</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProject && (
                <p className="font-mono text-xs text-zinc-400">
                  <Target size={12} className="inline mr-1" />
                  {prospectsCount} prospects in this project
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Intro Email Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start bg-zinc-950 border-zinc-800 text-zinc-300 h-12"
                  >
                    <CalendarIcon size={16} className="mr-2" />
                    {startDate ? format(startDate, 'PPP') : 'Pick start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="bg-zinc-900"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Send Time
              </Label>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-zinc-500" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 rounded-sm h-12 font-mono"
                />
              </div>
            </div>

            {/* Gap Days */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Gap Between Steps
                </Label>
                <span className="font-chivo font-bold text-2xl text-blue-400">
                  {gapDays} days
                </span>
              </div>
              <Slider
                value={[gapDays]}
                onValueChange={(val) => setGapDays(val[0])}
                min={1}
                max={14}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                <span>1 day</span>
                <span>14 days</span>
              </div>
              {selectedProject && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={updateProjectGap}
                  className="text-zinc-400 text-xs"
                >
                  <Settings size={12} className="mr-1" />
                  Save as project default
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Preview */}
        {startDate && (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 mb-6">
            <h3 className="font-chivo font-bold text-lg text-white mb-4">
              Schedule Preview
            </h3>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {previewDates.map((date, i) => (
                <div key={i} className="flex items-center">
                  <div className={`flex-shrink-0 p-4 rounded-sm border ${
                    i === 0 
                      ? "bg-blue-600/10 border-blue-600/30" 
                      : "bg-violet-600/10 border-violet-600/30"
                  }`}>
                    <p className={`font-chivo font-bold text-lg ${
                      i === 0 ? "text-blue-400" : "text-violet-400"
                    }`}>
                      Step {i + 1}
                    </p>
                    <p className="font-mono text-xs text-zinc-400">
                      {format(date, 'MMM d')}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {startTime}
                    </p>
                  </div>
                  {i < 4 && (
                    <div className="px-2 text-zinc-600">
                      <ArrowRight size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="font-mono text-xs text-zinc-500 mt-4">
              × {prospectsCount} prospects = <span className="text-white font-bold">{prospectsCount * 5} total tasks</span>
            </p>
          </Card>
        )}

        {/* Apply Button */}
        <Button
          onClick={handleApplyLever}
          disabled={applying || !selectedProject || !startDate || prospectsCount === 0}
          data-testid="apply-lever-btn"
          className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-bold text-lg btn-glow"
        >
          {applying ? (
            <span>Generating Tasks...</span>
          ) : (
            <>
              <Zap size={20} className="mr-2" />
              Apply Schedule Lever
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <Card className="bg-emerald-600/10 border border-emerald-600/30 rounded-sm p-6 mt-6">
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-emerald-500" />
              <div>
                <p className="font-chivo font-bold text-lg text-emerald-400">
                  Schedule Applied Successfully!
                </p>
                <p className="font-mono text-sm text-zinc-400">
                  Generated {result.tasks_count} tasks for {result.prospects_count} prospects
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
