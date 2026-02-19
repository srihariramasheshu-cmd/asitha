import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  FolderKanban, 
  Users, 
  Target,
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Globe,
  Mail,
  Settings,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [assignedSeats, setAssignedSeats] = useState([]);
  const [availableSeats, setAvailableSeats] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [mailDomains, setMailDomains] = useState([]);
  const [mailIds, setMailIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState("");
  const [assigning, setAssigning] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projectRes, prospectsRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}`),
        axios.get(`${API}/prospects?project_id=${projectId}`)
      ]);
      
      setProject(projectRes.data);
      setProspects(prospectsRes.data);

      // Fetch mail domains and IDs
      try {
        const [domainsRes, mailIdsRes] = await Promise.all([
          axios.get(`${API}/projects/${projectId}/mail-domains`),
          axios.get(`${API}/projects/${projectId}/mail-ids`)
        ]);
        setMailDomains(domainsRes.data);
        setMailIds(mailIdsRes.data);
      } catch {
        setMailDomains([]);
        setMailIds([]);
      }

      if (isAdmin) {
        const [seatsRes, allSeatsRes] = await Promise.all([
          axios.get(`${API}/projects/${projectId}/seats`),
          axios.get(`${API}/users/seats`)
        ]);
        setAssignedSeats(seatsRes.data);
        
        // Filter out already assigned seats
        const assignedIds = seatsRes.data.map(s => s.id);
        setAvailableSeats(allSeatsRes.data.filter(s => !assignedIds.includes(s.id)));
      }
    } catch (error) {
      toast.error("Failed to load project");
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSeat = async () => {
    if (!selectedSeat) return;
    setAssigning(true);
    try {
      await axios.post(`${API}/projects/${projectId}/assign?seat_id=${selectedSeat}`);
      toast.success("Seat assigned successfully");
      setShowAssignModal(false);
      setSelectedSeat("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign seat");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignSeat = async (seatId) => {
    if (!confirm("Remove this seat from the project?")) return;
    try {
      await axios.delete(`${API}/projects/${projectId}/assign/${seatId}`);
      toast.success("Seat removed from project");
      fetchData();
    } catch (error) {
      toast.error("Failed to remove seat");
    }
  };

  if (loading) {
    return (
      <MainLayout title="Project Details">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading project...</p>
        </div>
      </MainLayout>
    );
  }

  if (!project) return null;

  return (
    <MainLayout 
      title={project.name}
      subtitle={project.description || "No description"}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate("/projects")}
          className="border-zinc-700 text-zinc-300"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Projects
        </Button>
      }
    >
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
              <Target size={24} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Prospects
              </p>
              <p className="font-chivo font-bold text-2xl text-white mt-1">
                {prospects.length}
              </p>
            </div>
          </div>
        </Card>

        {isAdmin && (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
                <Users size={24} className="text-emerald-500" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Assigned Seats
                </p>
                <p className="font-chivo font-bold text-2xl text-white mt-1">
                  {assignedSeats.length}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
              <Globe size={24} className="text-violet-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Mail Domains
              </p>
              <p className="font-chivo font-bold text-2xl text-white mt-1">
                {mailDomains.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-sm bg-amber-600/10 border border-amber-600/20 flex items-center justify-center">
              <Mail size={24} className="text-amber-500" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Mail IDs
              </p>
              <p className="font-chivo font-bold text-2xl text-white mt-1">
                {mailIds.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Scheduler Config Summary */}
      <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-chivo font-bold text-lg text-white flex items-center gap-2">
            <Settings size={18} className="text-zinc-400" />
            Scheduler Configuration
          </h3>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/admin/schedule-lever")}
              className="border-zinc-700 text-zinc-300"
            >
              Configure
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="font-mono text-[10px] text-zinc-500 uppercase">Touchpoints</p>
            <p className="font-chivo font-bold text-lg text-white">{project.touchpoints_count || 5}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-zinc-500 uppercase">Max Mails/Day</p>
            <p className="font-chivo font-bold text-lg text-white">{project.max_mails_per_day_per_mail_id || 10}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-zinc-500 uppercase">Work Hours</p>
            <p className="font-chivo font-bold text-lg text-white">{project.work_start_time || "09:00"} - {project.work_end_time || "18:00"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-zinc-500 uppercase">Time Gap</p>
            <p className="font-chivo font-bold text-lg text-white">{project.min_time_gap_minutes || 5} min</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Seats (Admin Only) */}
        {isAdmin && (
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-chivo font-bold text-lg text-white">Assigned Seats</h3>
              <Button
                size="sm"
                onClick={() => setShowAssignModal(true)}
                data-testid="assign-seat-btn"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
              >
                <Plus size={14} className="mr-1" />
                Assign
              </Button>
            </div>

            {assignedSeats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Users size={32} strokeWidth={1} className="mb-2" />
                <p className="font-mono text-sm">No seats assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignedSeats.map((seat) => (
                  <div
                    key={seat.id}
                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-sm border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-sm bg-emerald-600 flex items-center justify-center">
                        <span className="font-chivo font-bold text-sm text-white">
                          {seat.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-manrope text-sm text-white">{seat.name}</p>
                        <p className="font-mono text-[10px] text-zinc-500">{seat.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnassignSeat(seat.id)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Mail Domains & IDs */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-chivo font-bold text-lg text-white">Mail Configuration</h3>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/admin/mail-management")}
                className="border-zinc-700 text-zinc-300"
              >
                Manage
              </Button>
            )}
          </div>
          
          {mailDomains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <Globe size={32} strokeWidth={1} className="mb-2" />
              <p className="font-mono text-sm">No mail domains configured</p>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => navigate("/admin/mail-management")}
                  className="text-blue-400 mt-2"
                >
                  Configure Mail Domains
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {mailDomains.map((domain) => {
                const domainMailIds = mailIds.filter(m => m.domain_id === domain.id);
                return (
                  <div key={domain.id} className="p-3 bg-zinc-800/50 rounded-sm border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe size={14} className="text-violet-500" />
                      <span className="font-mono text-sm text-white">{domain.domain}</span>
                      <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400 ml-auto">
                        {domainMailIds.length} mail IDs
                      </Badge>
                    </div>
                    {domainMailIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {domainMailIds.slice(0, 3).map((mailId) => (
                          <Badge key={mailId.id} className="text-[10px] bg-zinc-700 text-zinc-300">
                            {mailId.email.split('@')[0]}
                          </Badge>
                        ))}
                        {domainMailIds.length > 3 && (
                          <Badge className="text-[10px] bg-zinc-700 text-zinc-400">
                            +{domainMailIds.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Button
          onClick={() => navigate(`/prospects?project_id=${projectId}`)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-sm"
        >
          <Target size={16} className="mr-2" />
          View Prospects
        </Button>
        <Button
          onClick={() => navigate(`/prospects?project_id=${projectId}&upload=true`)}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm btn-glow"
        >
          <Upload size={16} className="mr-2" />
          Upload Prospects CSV
        </Button>
      </div>

      {/* Assign Seat Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Assign Seat to Project
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {availableSeats.length === 0 ? (
              <p className="font-mono text-sm text-zinc-400">
                All seats are already assigned to this project
              </p>
            ) : (
              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Select Seat
                </Label>
                <Select value={selectedSeat || "none"} onValueChange={(val) => setSelectedSeat(val === "none" ? "" : val)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm">
                    <SelectValue placeholder="Choose a seat..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="none" disabled>Choose a seat...</SelectItem>
                    {availableSeats.map((seat) => (
                      <SelectItem key={seat.id} value={seat.id}>
                        {seat.name} ({seat.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowAssignModal(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignSeat}
              disabled={assigning || !selectedSeat}
              data-testid="assign-seat-submit"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
            >
              {assigning ? "Assigning..." : "Assign Seat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
