import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Clock,
  CheckCircle,
  AlertCircle,
  Save,
  CalendarDays,
  Mail,
  Timer
} from "lucide-react";
import { toast } from "sonner";

export default function ScheduleLever() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Project config state
  const [config, setConfig] = useState({
    name: "",
    description: "",
    max_mails_per_day_per_mail_id: 10,
    min_time_gap_minutes: 5,
    time_jitter_minutes: 0,
    touchpoints_count: 5,
    touchpoint_gaps: [0, 3, 5, 7, 10],
    work_start_time: "09:00",
    work_end_time: "18:00",
    working_days: [1, 2, 3, 4, 5]
  });

  const weekDays = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" }
  ];

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        setConfig({
          name: project.name,
          description: project.description || "",
          max_mails_per_day_per_mail_id: project.max_mails_per_day_per_mail_id || 10,
          min_time_gap_minutes: project.min_time_gap_minutes || 5,
          time_jitter_minutes: project.time_jitter_minutes || 0,
          touchpoints_count: project.touchpoints_count || 5,
          touchpoint_gaps: project.touchpoint_gaps || [0, 3, 5, 7, 10],
          work_start_time: project.work_start_time || "09:00",
          work_end_time: project.work_end_time || "18:00",
          working_days: project.working_days || [1, 2, 3, 4, 5]
        });
      }
    }
  }, [selectedProjectId, projects]);

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

  const handleSaveConfig = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/projects/${selectedProjectId}`, config);
      toast.success("Project configuration saved!");
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTouchpointGapChange = (index, value) => {
    const newGaps = [...config.touchpoint_gaps];
    newGaps[index] = parseInt(value) || 0;
    setConfig({ ...config, touchpoint_gaps: newGaps });
  };

  const handleTouchpointsCountChange = (count) => {
    const newCount = parseInt(count);
    const newGaps = [...config.touchpoint_gaps];
    
    // Expand or shrink gaps array
    while (newGaps.length < newCount) {
      const lastGap = newGaps[newGaps.length - 1] || 0;
      newGaps.push(lastGap + 3);
    }
    newGaps.length = newCount;
    
    setConfig({ ...config, touchpoints_count: newCount, touchpoint_gaps: newGaps });
  };

  const toggleWorkingDay = (day) => {
    const newDays = config.working_days.includes(day)
      ? config.working_days.filter(d => d !== day)
      : [...config.working_days, day].sort((a, b) => a - b);
    setConfig({ ...config, working_days: newDays });
  };

  if (loading) {
    return (
      <MainLayout title="Scheduler Configuration">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Scheduler Configuration"
      subtitle="Configure email scheduling rules for your projects"
    >
      <div className="max-w-4xl space-y-6">
        {/* Project Selection */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Settings size={24} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-chivo font-bold text-lg text-white">Project Settings</h3>
              <p className="font-mono text-xs text-zinc-500">
                Select a project to configure its scheduling rules
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Select Project
            </Label>
            <Select 
              value={selectedProjectId || "select"} 
              onValueChange={(val) => setSelectedProjectId(val === "select" ? null : val)}
            >
              <SelectTrigger 
                className="bg-zinc-950 border-zinc-800 rounded-sm h-12"
                data-testid="project-select"
              >
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
          </div>
        </Card>

        {selectedProjectId && (
          <>
            {/* Email Limits */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-sm bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
                  <Mail size={24} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-chivo font-bold text-lg text-white">Email Limits</h3>
                  <p className="font-mono text-xs text-zinc-500">
                    Control email volume per mail ID
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max mails per day */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      Max Mails per Day per Mail-ID
                    </Label>
                    <span className="font-chivo font-bold text-2xl text-emerald-400">
                      {config.max_mails_per_day_per_mail_id}
                    </span>
                  </div>
                  <Slider
                    value={[config.max_mails_per_day_per_mail_id]}
                    onValueChange={(val) => setConfig({ ...config, max_mails_per_day_per_mail_id: val[0] })}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                    data-testid="max-mails-slider"
                  />
                  <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                    <span>1</span>
                    <span>50</span>
                  </div>
                </div>

                {/* Min time gap */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      Min Gap Between Mails
                    </Label>
                    <span className="font-chivo font-bold text-2xl text-emerald-400">
                      {config.min_time_gap_minutes} min
                    </span>
                  </div>
                  <Slider
                    value={[config.min_time_gap_minutes]}
                    onValueChange={(val) => setConfig({ ...config, min_time_gap_minutes: val[0] })}
                    min={1}
                    max={60}
                    step={1}
                    className="w-full"
                    data-testid="min-gap-slider"
                  />
                  <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                    <span>1 min</span>
                    <span>60 min</span>
                  </div>
                </div>
              </div>

              {/* Time Jitter */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Random Time Jitter
                  </Label>
                  <span className="font-chivo font-bold text-2xl text-emerald-400">
                    ±{config.time_jitter_minutes} min
                  </span>
                </div>
                <Slider
                  value={[config.time_jitter_minutes]}
                  onValueChange={(val) => setConfig({ ...config, time_jitter_minutes: val[0] })}
                  min={0}
                  max={30}
                  step={1}
                  className="w-full"
                  data-testid="jitter-slider"
                />
                <p className="font-mono text-[10px] text-zinc-600">
                  Adds randomness to send times for more natural delivery
                </p>
              </div>
            </Card>

            {/* Touchpoints Configuration */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-sm bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
                  <CalendarDays size={24} className="text-violet-500" />
                </div>
                <div>
                  <h3 className="font-chivo font-bold text-lg text-white">Touchpoints Sequence</h3>
                  <p className="font-mono text-xs text-zinc-500">
                    Configure the number and timing of follow-ups
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Number of touchpoints */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                      Number of Touchpoints
                    </Label>
                    <span className="font-chivo font-bold text-2xl text-violet-400">
                      {config.touchpoints_count}
                    </span>
                  </div>
                  <Slider
                    value={[config.touchpoints_count]}
                    onValueChange={(val) => handleTouchpointsCountChange(val[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                    data-testid="touchpoints-slider"
                  />
                  <div className="flex justify-between text-zinc-500 font-mono text-[10px]">
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Gap configuration for each touchpoint */}
                <div className="space-y-3">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Days Gap from Previous Touchpoint
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Array.from({ length: config.touchpoints_count }).map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="font-mono text-xs text-zinc-400">
                          {i === 0 ? "Intro" : `F/U ${i}`}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={config.touchpoint_gaps[i] ?? 0}
                          onChange={(e) => handleTouchpointGapChange(i, e.target.value)}
                          disabled={i === 0}
                          className="bg-zinc-950 border-zinc-800 h-10 font-mono text-center"
                          data-testid={`gap-input-${i}`}
                        />
                        <p className="font-mono text-[10px] text-zinc-600 text-center">
                          {i === 0 ? "Day 0" : "days"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Work Hours & Days */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-sm bg-amber-600/10 border border-amber-600/20 flex items-center justify-center">
                  <Timer size={24} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-chivo font-bold text-lg text-white">Work Schedule</h3>
                  <p className="font-mono text-xs text-zinc-500">
                    Define when emails can be scheduled
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Work hours */}
                <div className="space-y-4">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Work Hours
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="font-mono text-xs text-zinc-400 mb-1 block">Start</Label>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-zinc-500" />
                        <Input
                          type="time"
                          value={config.work_start_time}
                          onChange={(e) => setConfig({ ...config, work_start_time: e.target.value })}
                          className="bg-zinc-950 border-zinc-800 h-10 font-mono"
                          data-testid="work-start-time"
                        />
                      </div>
                    </div>
                    <span className="text-zinc-500 pt-6">to</span>
                    <div className="flex-1">
                      <Label className="font-mono text-xs text-zinc-400 mb-1 block">End</Label>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-zinc-500" />
                        <Input
                          type="time"
                          value={config.work_end_time}
                          onChange={(e) => setConfig({ ...config, work_end_time: e.target.value })}
                          className="bg-zinc-950 border-zinc-800 h-10 font-mono"
                          data-testid="work-end-time"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Working days */}
                <div className="space-y-4">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Working Days
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => (
                      <Button
                        key={day.value}
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWorkingDay(day.value)}
                        data-testid={`day-${day.value}`}
                        className={`h-10 w-12 font-mono text-sm ${
                          config.working_days.includes(day.value)
                            ? "bg-amber-600/20 border-amber-600/50 text-amber-400"
                            : "border-zinc-700 text-zinc-500"
                        }`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              data-testid="save-config-btn"
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-bold text-lg"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save size={20} className="mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </MainLayout>
  );
}
