import { useState, useRef } from "react";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  FileText,
  CheckCircle,
  AlertCircle,
  Download
} from "lucide-react";
import { toast } from "sonner";

export default function ScheduleUploadPage() {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error("Please select a CSV file");
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/tasks/schedule`, formData);
      setResult(res.data);
      toast.success(`Created ${res.data.created} tasks`);
      if (res.data.errors.length > 0) {
        toast.warning(`${res.data.errors.length} rows had errors`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload schedule");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    const csvContent = "prospect_id,step_number,send_date,send_time\n" +
      "abc123-example,1,2024-01-15,09:00\n" +
      "abc123-example,2,2024-01-18,10:30\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout 
      title="Upload Master Schedule"
      subtitle="Push scheduled tasks to seat dashboards"
    >
      <div className="max-w-2xl">
        {/* Instructions */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 mb-6">
          <h3 className="font-chivo font-bold text-lg text-white mb-4">CSV Format</h3>
          <p className="font-manrope text-zinc-400 text-sm mb-4">
            Your CSV must include the following columns:
          </p>
          
          <div className="bg-zinc-950 rounded-sm p-4 font-mono text-xs mb-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 px-2">Column</th>
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-left py-2 px-2">Example</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2 px-2 text-blue-400">prospect_id</td>
                  <td className="py-2 px-2">The prospect's unique ID</td>
                  <td className="py-2 px-2 text-zinc-500">abc123-def456</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2 px-2 text-blue-400">step_number</td>
                  <td className="py-2 px-2">Outreach step (1-4)</td>
                  <td className="py-2 px-2 text-zinc-500">1</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-2 px-2 text-blue-400">send_date</td>
                  <td className="py-2 px-2">Date to send (YYYY-MM-DD)</td>
                  <td className="py-2 px-2 text-zinc-500">2024-01-15</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-blue-400">send_time</td>
                  <td className="py-2 px-2">Time to send (HH:MM)</td>
                  <td className="py-2 px-2 text-zinc-500">09:00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-zinc-700 text-zinc-300"
          >
            <Download size={16} className="mr-2" />
            Download Template
          </Button>
        </Card>

        {/* Upload Area */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div 
            className="border-2 border-dashed border-zinc-800 rounded-sm p-12 text-center cursor-pointer hover:border-zinc-700 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="font-manrope text-zinc-400">Uploading schedule...</p>
              </>
            ) : (
              <>
                <Upload size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
                <p className="font-manrope text-zinc-400 text-lg">Click to upload schedule CSV</p>
                <p className="font-mono text-xs text-zinc-600 mt-2">
                  Tasks will be pushed to seat dashboards automatically
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="schedule-file-input"
          />
        </Card>

        {/* Results */}
        {result && (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 mt-6">
            <h3 className="font-chivo font-bold text-lg text-white mb-4">Upload Result</h3>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" />
                <span className="font-mono text-emerald-400">{result.created} tasks created</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-500" />
                  <span className="font-mono text-red-400">{result.errors.length} errors</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-zinc-950 rounded-sm p-4 max-h-48 overflow-y-auto">
                {result.errors.map((error, i) => (
                  <p key={i} className="font-mono text-xs text-red-400 mb-1">{error}</p>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
