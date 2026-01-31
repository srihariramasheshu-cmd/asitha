import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
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
  Users, 
  Plus, 
  Trash2, 
  Mail,
  FolderKanban,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

export default function SeatsPage() {
  const [seats, setSeats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSeat, setNewSeat] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [seatsRes, projectsRes] = await Promise.all([
        axios.get(`${API}/users/seats`),
        axios.get(`${API}/projects`)
      ]);
      setSeats(seatsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      toast.error("Failed to load seats");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeat = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post(`${API}/users`, {
        name: newSeat.name,
        email: newSeat.email,
        password: newSeat.password,
        role: "seat"
      });
      
      toast.success("Seat created successfully");
      setShowCreateModal(false);
      setNewSeat({ name: "", email: "", password: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create seat");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSeat = async (seatId) => {
    if (!confirm("Delete this seat? This will remove all their project assignments.")) return;
    
    try {
      await axios.delete(`${API}/users/${seatId}`);
      toast.success("Seat deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete seat");
    }
  };

  if (loading) {
    return (
      <MainLayout title="Seats Management">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading seats...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Seats Management"
      subtitle={`${seats.length} seats configured`}
      actions={
        <Button
          onClick={() => setShowCreateModal(true)}
          data-testid="create-seat-btn"
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm btn-glow"
        >
          <Plus size={18} className="mr-2" />
          Add Seat
        </Button>
      }
    >
      {seats.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <Users size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
          <p className="font-manrope text-zinc-400 text-lg">No seats yet</p>
          <p className="font-mono text-xs text-zinc-600 mt-2">
            Create your first seat to start assigning projects
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seats.map((seat, index) => (
            <Card
              key={seat.id}
              data-testid={`seat-card-${seat.id}`}
              className={`card-hover bg-zinc-900/50 border border-white/5 rounded-sm p-6 animate-fade-in animate-delay-${(index % 4 + 1) * 100}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-sm bg-emerald-600 flex items-center justify-center">
                  <span className="font-chivo font-bold text-xl text-white">
                    {seat.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSeat(seat.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </Button>
              </div>

              <h3 className="font-chivo font-bold text-lg text-white mb-1">
                {seat.name}
              </h3>
              
              <div className="flex items-center gap-2 text-zinc-400 mb-4">
                <Mail size={14} />
                <span className="font-mono text-sm truncate">{seat.email}</span>
              </div>

              <div className="pt-4 border-t border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Calendar size={14} />
                  <span className="font-mono text-xs">
                    Joined {new Date(seat.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Seat Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Add New Seat
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateSeat} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Full Name
              </Label>
              <Input
                value={newSeat.name}
                onChange={(e) => setNewSeat({ ...newSeat, name: e.target.value })}
                data-testid="seat-name-input"
                placeholder="John Doe"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-manrope"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Email Address
              </Label>
              <Input
                type="email"
                value={newSeat.email}
                onChange={(e) => setNewSeat({ ...newSeat, email: e.target.value })}
                data-testid="seat-email-input"
                placeholder="john@company.com"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Password
              </Label>
              <Input
                type="password"
                value={newSeat.password}
                onChange={(e) => setNewSeat({ ...newSeat, password: e.target.value })}
                data-testid="seat-password-input"
                placeholder="••••••••"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
                required
                minLength={6}
              />
            </div>

            <DialogFooter className="gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                data-testid="create-seat-submit"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
              >
                {creating ? "Creating..." : "Create Seat"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
