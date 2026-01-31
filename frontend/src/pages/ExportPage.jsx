import { useState, useEffect } from "react";
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
  Download, 
  FileText,
  Target,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function ExportPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState({});

  useEffect(() => {
    fetchProjects();
  }, []);

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

  const handleExport = async (type) => {
    setExporting({ ...exporting, [type]: true });
    
    try {
      let url = `${API}/export/${type}`;
      if (type === "prospects" && selectedProject) {
        url += `?project_id=${selectedProject}`;
      }
      
      const res = await axios.get(url, { responseType: 'blob' });
      
      // Create download link
      const blob = new Blob([res.data], { type: 'text/csv' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      
      toast.success(`${type} exported successfully`);
    } catch (error) {
      toast.error(`Failed to export ${type}`);
    } finally {
      setExporting({ ...exporting, [type]: false });
    }
  };

  if (loading) {
    return (
      <MainLayout title="Export Data">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Export Data"
      subtitle="Download aggregate CSVs for review"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Activity Export */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Activity size={24} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-chivo font-bold text-lg text-white">Activity Log</h3>
              <p className="font-manrope text-sm text-zinc-400 mt-1">
                Export all sent emails and replies across all seats
              </p>
            </div>
          </div>

          <div className="bg-zinc-950 rounded-sm p-4 mb-6">
            <p className="font-mono text-xs text-zinc-500 mb-2">Includes:</p>
            <ul className="space-y-1">
              <li className="font-mono text-xs text-zinc-400">• Task ID, Prospect ID</li>
              <li className="font-mono text-xs text-zinc-400">• Seat ID, Project ID</li>
              <li className="font-mono text-xs text-zinc-400">• Action type (sent/reply)</li>
              <li className="font-mono text-xs text-zinc-400">• Timestamp and details</li>
            </ul>
          </div>

          <Button
            onClick={() => handleExport('activity')}
            disabled={exporting.activity}
            data-testid="export-activity-btn"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-sm btn-glow"
          >
            {exporting.activity ? (
              <span>Exporting...</span>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                Export Activity CSV
              </>
            )}
          </Button>
        </Card>

        {/* Prospects Export */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-sm bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
              <Target size={24} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-chivo font-bold text-lg text-white">Prospects</h3>
              <p className="font-manrope text-sm text-zinc-400 mt-1">
                Export all prospect data with current status
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Filter by Project (optional)
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-zinc-950 rounded-sm p-4">
              <p className="font-mono text-xs text-zinc-500 mb-2">Includes:</p>
              <ul className="space-y-1">
                <li className="font-mono text-xs text-zinc-400">• Company & contact info</li>
                <li className="font-mono text-xs text-zinc-400">• Email, phone, LinkedIn</li>
                <li className="font-mono text-xs text-zinc-400">• Current status</li>
                <li className="font-mono text-xs text-zinc-400">• Project & seat assignment</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={() => handleExport('prospects')}
            disabled={exporting.prospects}
            data-testid="export-prospects-btn"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
          >
            {exporting.prospects ? (
              <span>Exporting...</span>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                Export Prospects CSV
              </>
            )}
          </Button>
        </Card>
      </div>
    </MainLayout>
  );
}
