import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Globe, 
  Mail, 
  Plus, 
  Trash2,
  User,
  UserPlus,
  UserMinus,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function MailManagementPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [domains, setDomains] = useState([]);
  const [mailIds, setMailIds] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [showAddMailId, setShowAddMailId] = useState(false);
  const [showAssignSeat, setShowAssignSeat] = useState(false);
  
  // Form states
  const [newDomain, setNewDomain] = useState("");
  const [newMailId, setNewMailId] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [selectedMailIdForAssign, setSelectedMailIdForAssign] = useState(null);
  const [selectedSeatId, setSelectedSeatId] = useState(null);

  useEffect(() => {
    fetchProjects();
    fetchSeats();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDomains();
      fetchMailIds();
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

  const fetchSeats = async () => {
    try {
      const res = await axios.get(`${API}/users/seats`);
      setSeats(res.data);
    } catch (error) {
      console.error("Failed to load seats");
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await axios.get(`${API}/projects/${selectedProjectId}/mail-domains`);
      setDomains(res.data);
    } catch (error) {
      setDomains([]);
    }
  };

  const fetchMailIds = async () => {
    try {
      const res = await axios.get(`${API}/projects/${selectedProjectId}/mail-ids`);
      setMailIds(res.data);
    } catch (error) {
      setMailIds([]);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    try {
      await axios.post(`${API}/mail-domains`, {
        domain: newDomain.toLowerCase(),
        project_id: selectedProjectId
      });
      toast.success("Domain added!");
      setNewDomain("");
      setShowAddDomain(false);
      fetchDomains();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add domain");
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!confirm("Delete this domain and all its mail IDs?")) return;
    
    try {
      await axios.delete(`${API}/mail-domains/${domainId}`);
      toast.success("Domain deleted");
      fetchDomains();
      fetchMailIds();
    } catch (error) {
      toast.error("Failed to delete domain");
    }
  };

  const handleAddMailId = async () => {
    if (!newMailId.trim() || !selectedDomainId) {
      toast.error("Please enter an email and select a domain");
      return;
    }

    try {
      await axios.post(`${API}/mail-ids`, {
        email: newMailId.toLowerCase(),
        domain_id: selectedDomainId
      });
      toast.success("Mail ID added!");
      setNewMailId("");
      setSelectedDomainId(null);
      setShowAddMailId(false);
      fetchMailIds();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add mail ID");
    }
  };

  const handleDeleteMailId = async (mailIdId) => {
    if (!confirm("Delete this mail ID?")) return;
    
    try {
      await axios.delete(`${API}/mail-ids/${mailIdId}`);
      toast.success("Mail ID deleted");
      fetchMailIds();
    } catch (error) {
      toast.error("Failed to delete mail ID");
    }
  };

  const handleAssignSeat = async () => {
    try {
      await axios.put(`${API}/mail-ids/${selectedMailIdForAssign}/assign`, {
        seat_id: selectedSeatId
      });
      toast.success(selectedSeatId ? "Seat assigned!" : "Seat unassigned!");
      setShowAssignSeat(false);
      setSelectedMailIdForAssign(null);
      setSelectedSeatId(null);
      fetchMailIds();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign seat");
    }
  };

  const openAssignModal = (mailId) => {
    setSelectedMailIdForAssign(mailId.id);
    setSelectedSeatId(mailId.seat_id || null);
    setShowAssignSeat(true);
  };

  const getSeatName = (seatId) => {
    const seat = seats.find(s => s.id === seatId);
    return seat ? seat.name : "Unknown";
  };

  const getDomainName = (domainId) => {
    const domain = domains.find(d => d.id === domainId);
    return domain ? domain.domain : "Unknown";
  };

  if (loading) {
    return (
      <MainLayout title="Mail Management">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Mail Management"
      subtitle="Configure mail domains and assign mail IDs to seats"
    >
      <div className="max-w-6xl space-y-6">
        {/* Project Selection */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1 max-w-md">
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
          </div>
        </Card>

        {selectedProjectId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domains Section */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                    <Globe size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-chivo font-bold text-lg text-white">Mail Domains</h3>
                    <p className="font-mono text-xs text-zinc-500">{domains.length} domains</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowAddDomain(true)}
                  size="sm"
                  data-testid="add-domain-btn"
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  <Plus size={16} className="mr-1" />
                  Add Domain
                </Button>
              </div>

              {domains.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-sm">
                  <Globe size={32} className="mx-auto text-zinc-600 mb-2" />
                  <p className="font-mono text-sm text-zinc-500">No domains configured</p>
                  <p className="font-mono text-xs text-zinc-600">Add a domain to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {domains.map((domain) => (
                    <div 
                      key={domain.id}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-sm border border-zinc-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <Globe size={16} className="text-blue-400" />
                        <span className="font-mono text-sm text-white">{domain.domain}</span>
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {mailIds.filter(m => m.domain_id === domain.id).length} mail IDs
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-600/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Mail IDs Section */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
                    <Mail size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-chivo font-bold text-lg text-white">Mail IDs</h3>
                    <p className="font-mono text-xs text-zinc-500">{mailIds.length} mail IDs</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowAddMailId(true)}
                  size="sm"
                  disabled={domains.length === 0}
                  data-testid="add-mailid-btn"
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Plus size={16} className="mr-1" />
                  Add Mail ID
                </Button>
              </div>

              {domains.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-sm">
                  <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
                  <p className="font-mono text-sm text-zinc-500">Add a domain first</p>
                </div>
              ) : mailIds.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-zinc-800 rounded-sm">
                  <Mail size={32} className="mx-auto text-zinc-600 mb-2" />
                  <p className="font-mono text-sm text-zinc-500">No mail IDs configured</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {mailIds.map((mailId) => (
                    <div 
                      key={mailId.id}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-sm border border-zinc-700/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-emerald-400" />
                          <span className="font-mono text-sm text-white">{mailId.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {mailId.seat_id ? (
                            <Badge className="bg-violet-600/20 text-violet-400 border-violet-600/30 text-[10px]">
                              <User size={10} className="mr-1" />
                              {getSeatName(mailId.seat_id)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-500">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssignModal(mailId)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-600/10"
                        >
                          {mailId.seat_id ? <UserMinus size={14} /> : <UserPlus size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMailId(mailId.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-600/10"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Add Domain Modal */}
        <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="font-chivo text-white">Add Mail Domain</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-zinc-400">Domain Name</Label>
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="bg-zinc-950 border-zinc-700"
                  data-testid="domain-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDomain(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button onClick={handleAddDomain} className="bg-blue-600 hover:bg-blue-500">
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Mail ID Modal */}
        <Dialog open={showAddMailId} onOpenChange={setShowAddMailId}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="font-chivo text-white">Add Mail ID</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-zinc-400">Select Domain</Label>
                <Select value={selectedDomainId || "select"} onValueChange={(val) => setSelectedDomainId(val === "select" ? null : val)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select domain..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="select" disabled>Select domain...</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs text-zinc-400">Email Address</Label>
                <Input
                  placeholder={selectedDomainId ? `user@${getDomainName(selectedDomainId)}` : "user@domain.com"}
                  value={newMailId}
                  onChange={(e) => setNewMailId(e.target.value)}
                  className="bg-zinc-950 border-zinc-700"
                  data-testid="mailid-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMailId(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button onClick={handleAddMailId} className="bg-emerald-600 hover:bg-emerald-500">
                Add Mail ID
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Seat Modal */}
        <Dialog open={showAssignSeat} onOpenChange={setShowAssignSeat}>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="font-chivo text-white">Assign Seat to Mail ID</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-zinc-400">Select Seat</Label>
                <Select value={selectedSeatId || "none"} onValueChange={(val) => setSelectedSeatId(val === "none" ? null : val)}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select seat..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="none">Unassign (No seat)</SelectItem>
                    {seats.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignSeat(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button onClick={handleAssignSeat} className="bg-violet-600 hover:bg-violet-500">
                {selectedSeatId ? "Assign Seat" : "Unassign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
