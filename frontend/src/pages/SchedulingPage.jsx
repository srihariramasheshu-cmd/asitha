import { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Calendar, 
  Play, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Target,
  Mail,
  Clock,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function SchedulingPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [configCheck, setConfigCheck] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      checkConfig();
      fetchReports();
    }
  }, [selectedProjectId]);

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

  const checkConfig = async () => {
    try {
      const res = await axios.post(`${API}/projects/${selectedProjectId}/check-config`);
      setConfigCheck(res.data);
    } catch (error) {
      setConfigCheck(null);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API}/projects/${selectedProjectId}/scheduling-reports`);
      setReports(res.data);
    } catch (error) {
      setReports([]);
    }
  };

  const handleSchedule = async () => {
    if (!configCheck?.ready) {
      toast.error("Please resolve configuration issues first");
      return;
    }

    setScheduling(true);
    try {
      const res = await axios.post(`${API}/projects/${selectedProjectId}/schedule-prospects`);
      toast.success(`Scheduled ${res.data.scheduled_prospects} prospects!`);
      if (res.data.failed_prospects > 0) {
        toast.warning(`${res.data.failed_prospects} prospects could not be scheduled`);
      }
      fetchReports();
      setSelectedReport(res.data);
      setShowReportModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to schedule prospects");
    } finally {
      setScheduling(false);
    }
  };

  const viewReport = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  if (loading) {
    return (
      <MainLayout title="Schedule Prospects">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Schedule Prospects"
      subtitle="Auto-schedule your uploaded prospects"
    >
      <div className="max-w-4xl space-y-6">
        {/* Project Selection */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Calendar size={24} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-chivo font-bold text-lg text-white">Auto-Schedule</h3>
              <p className="font-mono text-xs text-zinc-500">
                Schedule all unscheduled prospects in a project
              </p>
            </div>
          </div>

          <div className="space-y-2">
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

        {/* Config Check */}
        {selectedProjectId && configCheck && (
          <Card className={`border rounded-sm p-6 ${
            configCheck.ready 
              ? "bg-emerald-600/10 border-emerald-600/30" 
              : "bg-amber-600/10 border-amber-600/30"
          }`}>
            <div className="flex items-start gap-4">
              {configCheck.ready ? (
                <CheckCircle size={24} className="text-emerald-500 mt-1" />
              ) : (
                <AlertTriangle size={24} className="text-amber-500 mt-1" />
              )}
              <div className="flex-1">
                <h3 className={`font-chivo font-bold text-lg ${
                  configCheck.ready ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {configCheck.ready ? "Ready to Schedule" : "Configuration Required"}
                </h3>
                
                {!configCheck.ready && (
                  <ul className="mt-2 space-y-1">
                    {configCheck.issues.map((issue, i) => (
                      <li key={i} className="font-mono text-sm text-zinc-400 flex items-center gap-2">
                        <XCircle size={14} className="text-red-400" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Mail size={14} />
                    <span className="font-mono">{configCheck.mail_ids_count} mail IDs</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Target size={14} />
                    <span className="font-mono">{configCheck.touchpoints_count} touchpoints</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Schedule Button */}
        {selectedProjectId && (
          <Button
            onClick={handleSchedule}
            disabled={scheduling || !configCheck?.ready}
            data-testid="schedule-btn"
            className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-bold text-lg disabled:opacity-50"
          >
            {scheduling ? (
              <span>Scheduling...</span>
            ) : (
              <>
                <Play size={20} className="mr-2" />
                Schedule Unscheduled Prospects
              </>
            )}
          </Button>
        )}

        {/* Scheduling Reports */}
        {selectedProjectId && reports.length > 0 && (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-sm bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
                <FileText size={20} className="text-violet-500" />
              </div>
              <div>
                <h3 className="font-chivo font-bold text-lg text-white">Scheduling History</h3>
                <p className="font-mono text-xs text-zinc-500">{reports.length} reports</p>
              </div>
            </div>

            <div className="space-y-2">
              {reports.map((report) => (
                <div 
                  key={report.id}
                  onClick={() => viewReport(report)}
                  className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-sm border border-zinc-700/50 cursor-pointer hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-mono text-sm text-white">
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                      <p className="font-mono text-xs text-zinc-500">
                        {new Date(report.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                        <CheckCircle size={12} className="mr-1" />
                        {report.scheduled_prospects} scheduled
                      </Badge>
                      {report.failed_prospects > 0 && (
                        <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
                          <XCircle size={12} className="mr-1" />
                          {report.failed_prospects} failed
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                        {report.total_tasks_created} tasks
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-500" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Report Detail Modal */}
        <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-chivo text-white flex items-center gap-2">
                <FileText size={20} className="text-violet-500" />
                Scheduling Report
              </DialogTitle>
            </DialogHeader>
            
            {selectedReport && (
              <div className="space-y-6 mt-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-800/50 rounded-sm p-4 text-center">
                    <p className="font-chivo font-bold text-2xl text-white">{selectedReport.total_prospects}</p>
                    <p className="font-mono text-xs text-zinc-500">Total Prospects</p>
                  </div>
                  <div className="bg-emerald-600/10 rounded-sm p-4 text-center border border-emerald-600/30">
                    <p className="font-chivo font-bold text-2xl text-emerald-400">{selectedReport.scheduled_prospects}</p>
                    <p className="font-mono text-xs text-zinc-500">Scheduled</p>
                  </div>
                  <div className={`rounded-sm p-4 text-center ${
                    selectedReport.failed_prospects > 0 
                      ? "bg-red-600/10 border border-red-600/30" 
                      : "bg-zinc-800/50"
                  }`}>
                    <p className={`font-chivo font-bold text-2xl ${
                      selectedReport.failed_prospects > 0 ? "text-red-400" : "text-zinc-400"
                    }`}>{selectedReport.failed_prospects}</p>
                    <p className="font-mono text-xs text-zinc-500">Failed</p>
                  </div>
                </div>

                {/* Config Used */}
                {selectedReport.report_data?.config && (
                  <div className="bg-zinc-800/30 rounded-sm p-4">
                    <p className="font-mono text-xs text-zinc-500 mb-3 uppercase">Configuration Used</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Max mails/day/mail-id:</span>
                        <span className="text-zinc-300">{selectedReport.report_data.config.max_mails_per_day}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Min time gap:</span>
                        <span className="text-zinc-300">{selectedReport.report_data.config.min_time_gap} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Time jitter:</span>
                        <span className="text-zinc-300">±{selectedReport.report_data.config.time_jitter} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Touchpoints:</span>
                        <span className="text-zinc-300">{selectedReport.report_data.config.touchpoints_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Work hours:</span>
                        <span className="text-zinc-300">{selectedReport.report_data.config.work_hours}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Mail IDs used:</span>
                        <span className="text-zinc-300">{selectedReport.report_data.config.mail_ids_used}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scheduled Prospects */}
                {selectedReport.report_data?.scheduled?.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-zinc-500 mb-3 uppercase">Scheduled Prospects</p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {selectedReport.report_data.scheduled.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-sm text-sm">
                          <div>
                            <span className="text-zinc-300">{p.company_name}</span>
                            <span className="text-zinc-500 ml-2">({p.contact_name})</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs">
                            <Mail size={12} />
                            <span>{p.assigned_mail_email}</span>
                            <span className="text-zinc-600">|</span>
                            <Clock size={12} />
                            <span>{p.first_task_date} → {p.last_task_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Prospects */}
                {selectedReport.report_data?.failed?.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-red-400 mb-3 uppercase">Failed Prospects</p>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {selectedReport.report_data.failed.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-red-600/10 rounded-sm text-sm border border-red-600/20">
                          <span className="text-zinc-300">{p.company_name} ({p.contact_name})</span>
                          <span className="text-red-400 font-mono text-xs">{p.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setShowReportModal(false)} className="border-zinc-700">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
