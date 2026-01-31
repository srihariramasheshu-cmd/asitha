import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Target, 
  Upload, 
  Plus,
  Search,
  ArrowRight,
  Trash2,
  Mail,
  Building,
  User
} from "lucide-react";
import { toast } from "sonner";

// Schema fields that prospects can be mapped to
const SCHEMA_FIELDS = [
  { key: "company_name", label: "Company Name", required: true },
  { key: "contact_name", label: "Contact Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "title", label: "Title" },
  { key: "domain", label: "Domain" },
];

export default function ProspectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [prospects, setProspects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState(searchParams.get("project_id") || "");
  
  // CSV Upload state
  const [showUploadModal, setShowUploadModal] = useState(searchParams.get("upload") === "true");
  const [uploadStep, setUploadStep] = useState(1); // 1: select file, 2: map columns, 3: confirm
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProject, setUploadProject] = useState(selectedProject);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedProject]);

  const fetchData = async () => {
    try {
      const [prospectsRes, projectsRes] = await Promise.all([
        axios.get(`${API}/prospects${selectedProject ? `?project_id=${selectedProject}` : ''}`),
        axios.get(`${API}/projects`)
      ]);
      setProspects(prospectsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error("Please select a CSV file");
      return;
    }

    setSelectedFile(file);
    
    // Parse CSV to get headers
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/prospects/upload/parse`, formData);
      setCsvHeaders(res.data.headers);
      setCsvPreview(res.data.preview);
      
      // Auto-map columns with similar names
      const autoMappings = {};
      SCHEMA_FIELDS.forEach(field => {
        const match = res.data.headers.find(h => 
          h.toLowerCase().includes(field.key.replace('_', ' ').toLowerCase()) ||
          h.toLowerCase().includes(field.label.toLowerCase())
        );
        if (match) {
          autoMappings[field.key] = match;
        }
      });
      setColumnMappings(autoMappings);
      
      setUploadStep(2);
    } catch (error) {
      toast.error("Failed to parse CSV file");
    }
  };

  const handleImport = async () => {
    if (!uploadProject) {
      toast.error("Please select a project");
      return;
    }

    // Validate required mappings
    const missingRequired = SCHEMA_FIELDS.filter(f => f.required && !columnMappings[f.key]);
    if (missingRequired.length > 0) {
      toast.error(`Missing required mappings: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('project_id', uploadProject);
    formData.append('mappings', JSON.stringify(columnMappings));

    try {
      const res = await axios.post(`${API}/prospects/upload/import`, formData);
      toast.success(`Imported ${res.data.imported} prospects`);
      if (res.data.errors.length > 0) {
        toast.warning(`${res.data.errors.length} rows had errors`);
      }
      resetUpload();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to import prospects");
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setShowUploadModal(false);
    setUploadStep(1);
    setCsvHeaders([]);
    setCsvPreview([]);
    setColumnMappings({});
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteProspect = async (prospectId) => {
    if (!confirm("Delete this prospect and all related data?")) return;
    
    try {
      await axios.delete(`${API}/prospects/${prospectId}`);
      toast.success("Prospect deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete prospect");
    }
  };

  const filteredProspects = prospects.filter(p => 
    p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const statusClasses = {
      new: "status-new",
      replied: "status-replied",
      sent: "status-sent",
    };
    const baseClass = Object.keys(statusClasses).find(k => status.includes(k)) || "new";
    return statusClasses[baseClass] || "status-new";
  };

  if (loading) {
    return (
      <MainLayout title="Prospects">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading prospects...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Prospects"
      subtitle={`${filteredProspects.length} prospects`}
      actions={
        <Button
          onClick={() => setShowUploadModal(true)}
          data-testid="upload-prospects-btn"
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm btn-glow"
        >
          <Upload size={18} className="mr-2" />
          Upload CSV
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <Input
            placeholder="Search prospects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-prospects"
            className="pl-10 bg-zinc-900 border-zinc-800 rounded-sm font-mono"
          />
        </div>
        
        <Select value={selectedProject || "all"} onValueChange={(val) => setSelectedProject(val === "all" ? "" : val)}>
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
      </div>

      {/* Prospects Table */}
      {filteredProspects.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <Target size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
          <p className="font-manrope text-zinc-400 text-lg">No prospects found</p>
          <p className="font-mono text-xs text-zinc-600 mt-2">
            Upload a CSV to add prospects
          </p>
        </Card>
      ) : (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <TableRow 
                  key={prospect.id}
                  data-testid={`prospect-row-${prospect.id}`}
                  className="cursor-pointer"
                  onClick={() => navigate(`/prospects/${prospect.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                        <Building size={14} className="text-blue-500" />
                      </div>
                      <span className="font-manrope text-zinc-200">{prospect.company_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-zinc-500" />
                      <span>{prospect.contact_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-zinc-500" />
                      <span className="text-zinc-400">{prospect.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono text-xs px-2 py-1 rounded-sm ${getStatusBadge(prospect.status)}`}>
                      {prospect.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/prospects/${prospect.id}`)}
                        className="text-zinc-400 hover:text-white"
                      >
                        View
                        <ArrowRight size={14} className="ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProspect(prospect.id)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Upload CSV Modal */}
      <Dialog open={showUploadModal} onOpenChange={(open) => !open && resetUpload()}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              {uploadStep === 1 && "Upload Prospects CSV"}
              {uploadStep === 2 && "Map CSV Columns"}
            </DialogTitle>
          </DialogHeader>
          
          {uploadStep === 1 && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Select Project
                </Label>
                <Select value={uploadProject || "none"} onValueChange={(val) => setUploadProject(val === "none" ? "" : val)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="none" disabled>Choose a project...</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  CSV File
                </Label>
                <div 
                  className="border-2 border-dashed border-zinc-800 rounded-sm p-8 text-center cursor-pointer hover:border-zinc-700 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} className="mx-auto text-zinc-600 mb-3" strokeWidth={1} />
                  <p className="font-manrope text-zinc-400">Click to upload or drag and drop</p>
                  <p className="font-mono text-xs text-zinc-600 mt-1">CSV files only</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="csv-file-input"
                />
              </div>
            </div>
          )}

          {uploadStep === 2 && (
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
              <p className="font-mono text-xs text-zinc-400">
                Map your CSV columns to the prospect fields. Required fields are marked with *.
              </p>
              
              <div className="space-y-3">
                {SCHEMA_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <Label className="w-32 font-mono text-xs text-zinc-400">
                      {field.label}{field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select 
                      value={columnMappings[field.key] || "skip"} 
                      onValueChange={(val) => setColumnMappings({ ...columnMappings, [field.key]: val === "skip" ? "" : val })}
                    >
                      <SelectTrigger className="flex-1 bg-zinc-950 border-zinc-800 rounded-sm">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="skip">-- Skip --</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div className="mt-6">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block">
                    Preview (first 3 rows)
                  </Label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {csvHeaders.slice(0, 5).map((h) => (
                            <th key={h} className="px-2 py-1 text-left text-zinc-500 font-mono">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i} className="border-b border-zinc-800/50">
                            {csvHeaders.slice(0, 5).map((h) => (
                              <td key={h} className="px-2 py-1 text-zinc-400 font-mono truncate max-w-[150px]">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={resetUpload}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            {uploadStep === 2 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setUploadStep(1)}
                  className="border-zinc-700 text-zinc-300"
                >
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={uploading}
                  data-testid="import-csv-btn"
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
                >
                  {uploading ? "Importing..." : "Import Prospects"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
