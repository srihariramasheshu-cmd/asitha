import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Linkedin,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  Send,
  MessageSquarePlus,
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_BADGE,
  SOURCE_BADGE,
  STATUSES,
  SOURCES,
  STATUS_LABEL,
  SOURCE_LABEL,
  FOLLOWUP_TYPES,
} from "@/lib/crmStyles";

export default function ResponderDetailPage() {
  const { responderId } = useParams();
  const navigate = useNavigate();

  const [responder, setResponder] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  const [showFollowup, setShowFollowup] = useState(false);
  const [fForm, setFForm] = useState({
    due_date: new Date().toISOString().slice(0, 10),
    due_time: "09:00",
    type: "email",
    notes: "",
    assigned_to: "",
  });
  const [fSubmitting, setFSubmitting] = useState(false);

  const [completing, setCompleting] = useState(null);
  const [outcomeText, setOutcomeText] = useState("");

  const load = async () => {
    try {
      const [r, f, a, t] = await Promise.all([
        axios.get(`${API}/crm/responders/${responderId}`),
        axios.get(`${API}/crm/followups`, { params: { responder_id: responderId } }),
        axios.get(`${API}/crm/responders/${responderId}/activity`),
        axios.get(`${API}/crm/team`),
      ]);
      setResponder(r.data);
      setFollowups(f.data);
      setActivity(a.data);
      setTeam(t.data);
    } catch (e) {
      toast.error("Failed to load responder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responderId]);

  const startEdit = () => {
    setEditForm({
      full_name: responder.full_name,
      email: responder.email,
      company: responder.company,
      title: responder.title,
      phone: responder.phone,
      linkedin: responder.linkedin,
      source: responder.source,
      campaign_name: responder.campaign_name,
      response_date: responder.response_date,
      response_summary: responder.response_summary,
      status: responder.status,
      owner_id: responder.owner_id || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editForm };
      if (!payload.owner_id) payload.owner_id = null;
      await axios.put(`${API}/crm/responders/${responderId}`, payload);
      toast.success("Saved");
      setEditing(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await axios.put(`${API}/crm/responders/${responderId}`, { status: newStatus });
      toast.success(`Status: ${STATUS_LABEL[newStatus]}`);
      load();
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const updateOwner = async (ownerId) => {
    try {
      await axios.put(`${API}/crm/responders/${responderId}`, {
        owner_id: ownerId === "none" ? null : ownerId,
      });
      toast.success("Owner updated");
      load();
    } catch (e) {
      toast.error("Failed to update owner");
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setPostingNote(true);
    try {
      await axios.post(`${API}/crm/notes`, {
        responder_id: responderId,
        content: noteText.trim(),
      });
      setNoteText("");
      load();
    } catch (e) {
      toast.error("Failed to add note");
    } finally {
      setPostingNote(false);
    }
  };

  const createFollowup = async () => {
    if (!fForm.due_date) {
      toast.error("Pick a date");
      return;
    }
    setFSubmitting(true);
    try {
      const payload = { ...fForm, responder_id: responderId };
      if (!payload.assigned_to) delete payload.assigned_to;
      await axios.post(`${API}/crm/followups`, payload);
      toast.success("Follow-up scheduled");
      setShowFollowup(false);
      setFForm({
        due_date: new Date().toISOString().slice(0, 10),
        due_time: "09:00",
        type: "email",
        notes: "",
        assigned_to: "",
      });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to schedule");
    } finally {
      setFSubmitting(false);
    }
  };

  const completeFollowup = async (id) => {
    try {
      await axios.put(`${API}/crm/followups/${id}`, {
        status: "done",
        outcome: outcomeText,
      });
      toast.success("Follow-up completed");
      setCompleting(null);
      setOutcomeText("");
      load();
    } catch (e) {
      toast.error("Failed to complete");
    }
  };

  const skipFollowup = async (id) => {
    try {
      await axios.put(`${API}/crm/followups/${id}`, { status: "skipped" });
      toast.success("Skipped");
      load();
    } catch (e) {
      toast.error("Failed to skip");
    }
  };

  const deleteFollowup = async (id) => {
    if (!confirm("Delete this follow-up?")) return;
    try {
      await axios.delete(`${API}/crm/followups/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  if (loading || !responder) {
    return (
      <MainLayout title="Responder">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading…</p>
        </div>
      </MainLayout>
    );
  }

  const pending = followups.filter((f) => f.status === "pending");
  const past = followups.filter((f) => f.status !== "pending");

  return (
    <MainLayout
      title={responder.full_name}
      subtitle={
        responder.company ? `${responder.company} · ${responder.title || "—"}` : ""
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/crm/responders")}
            className="border-zinc-700 text-zinc-300"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <Button
            onClick={startEdit}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-sm"
            data-testid="edit-responder"
          >
            <Edit3 size={16} className="mr-2" />
            Edit
          </Button>
          <Button
            onClick={() => setShowFollowup(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-bold"
            data-testid="add-followup-btn"
          >
            <CalendarPlus size={16} className="mr-2" />
            Schedule Follow-up
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: contact + status */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${SOURCE_BADGE[responder.source] || ""}`}
            >
              {responder.source}
            </span>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${STATUS_BADGE[responder.status] || ""}`}
            >
              {STATUS_LABEL[responder.status] || responder.status}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            {responder.email && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Mail size={14} className="text-zinc-500" />
                <a
                  href={`mailto:${responder.email}`}
                  className="font-mono text-[12px] hover:text-blue-400"
                >
                  {responder.email}
                </a>
              </div>
            )}
            {responder.phone && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Phone size={14} className="text-zinc-500" />
                <span className="font-mono text-[12px]">{responder.phone}</span>
              </div>
            )}
            {responder.linkedin && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Linkedin size={14} className="text-zinc-500" />
                <a
                  href={responder.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] truncate hover:text-blue-400"
                >
                  {responder.linkedin}
                </a>
              </div>
            )}
            {responder.company && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Building size={14} className="text-zinc-500" />
                <span className="font-mono text-[12px]">{responder.company}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Status
              </Label>
              <Select
                value={responder.status}
                onValueChange={updateStatus}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Owner
              </Label>
              <Select
                value={responder.owner_id || "none"}
                onValueChange={updateOwner}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">Unassigned</SelectItem>
                  {team.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Campaign</span>
              <span className="text-zinc-300">
                {responder.campaign_name || "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Responded</span>
              <span className="text-zinc-300">
                {responder.response_date || "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Added by</span>
              <span className="text-zinc-300">
                {responder.created_by_name || "—"}
              </span>
            </div>
          </div>

          {responder.response_summary && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block">
                Initial Response
              </Label>
              <p className="font-manrope text-sm text-zinc-300 whitespace-pre-wrap">
                {responder.response_summary}
              </p>
            </div>
          )}
        </Card>

        {/* Middle column: follow-ups */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 lg:col-span-1">
          <h2 className="font-chivo font-bold text-lg text-white mb-4">
            Follow-ups
          </h2>

          {pending.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 mb-4">
              Nothing scheduled. Plan the next touch.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {pending.map((f) => (
                <div
                  key={f.id}
                  className="border border-zinc-800 rounded-sm p-3 bg-zinc-950/40"
                  data-testid={`followup-${f.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                      {f.type}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {f.due_date} · {f.due_time}
                    </span>
                  </div>
                  {f.notes && (
                    <p className="font-manrope text-xs text-zinc-300 mb-2">
                      {f.notes}
                    </p>
                  )}
                  {f.assigned_to_name && (
                    <p className="font-mono text-[10px] text-zinc-500 mb-2">
                      Assigned to {f.assigned_to_name}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setCompleting(f.id);
                        setOutcomeText("");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm h-7 text-xs"
                    >
                      <CheckCircle2 size={12} className="mr-1" />
                      Done
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => skipFollowup(f.id)}
                      className="border-zinc-700 text-zinc-300 rounded-sm h-7 text-xs"
                    >
                      <XCircle size={12} className="mr-1" />
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteFollowup(f.id)}
                      className="text-zinc-500 hover:text-red-400 h-7 text-xs"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 mt-4">
                Past
              </h3>
              <div className="space-y-2">
                {past.map((f) => (
                  <div
                    key={f.id}
                    className="border border-zinc-800/60 rounded-sm p-3 bg-zinc-950/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        {f.type} · {f.status}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-600">
                        {f.due_date}
                      </span>
                    </div>
                    {f.outcome && (
                      <p className="font-manrope text-xs text-zinc-400 mt-1">
                        {f.outcome}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Right column: activity */}
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6 lg:col-span-1">
          <h2 className="font-chivo font-bold text-lg text-white mb-4">
            Activity
          </h2>

          <div className="flex gap-2 mb-4">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="bg-zinc-950 border-zinc-800 rounded-sm font-mono text-xs"
              data-testid="note-input"
            />
            <Button
              onClick={addNote}
              disabled={postingNote || !noteText.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
              data-testid="post-note"
            >
              <Send size={14} />
            </Button>
          </div>

          {activity.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500">No activity yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {activity.map((a) => (
                <div key={a.id} className="border-l border-zinc-800 pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    {a.type === "note" ? (
                      <MessageSquarePlus size={12} className="text-blue-400" />
                    ) : (
                      <Clock size={12} className="text-zinc-500" />
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      {a.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="font-manrope text-xs text-zinc-300 whitespace-pre-wrap">
                    {a.content}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-600 mt-1">
                    {a.actor_name || "system"} ·{" "}
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Schedule follow-up modal */}
      <Dialog open={showFollowup} onOpenChange={setShowFollowup}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Schedule Follow-up
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Date
              </Label>
              <Input
                type="date"
                value={fForm.due_date}
                onChange={(e) =>
                  setFForm({ ...fForm, due_date: e.target.value })
                }
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Time
              </Label>
              <Input
                type="time"
                value={fForm.due_time}
                onChange={(e) =>
                  setFForm({ ...fForm, due_time: e.target.value })
                }
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Type
              </Label>
              <Select
                value={fForm.type}
                onValueChange={(v) => setFForm({ ...fForm, type: v })}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {FOLLOWUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Assign to
              </Label>
              <Select
                value={fForm.assigned_to || "none"}
                onValueChange={(v) =>
                  setFForm({ ...fForm, assigned_to: v === "none" ? "" : v })
                }
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">Anyone</SelectItem>
                  {team.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Notes
              </Label>
              <Textarea
                rows={3}
                value={fForm.notes}
                onChange={(e) => setFForm({ ...fForm, notes: e.target.value })}
                placeholder="What should happen on this touch?"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setShowFollowup(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={createFollowup}
              disabled={fSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
              data-testid="submit-followup"
            >
              {fSubmitting ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete follow-up modal */}
      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Mark as Done
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Outcome (optional)
            </Label>
            <Textarea
              rows={4}
              value={outcomeText}
              onChange={(e) => setOutcomeText(e.target.value)}
              placeholder="What happened? Any next steps?"
              className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
            />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setCompleting(null)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() => completeFollowup(completing)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
            >
              <CheckCircle2 size={14} className="mr-2" />
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit responder modal */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Edit Responder
            </DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="col-span-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Full Name
                </Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Email
                </Label>
                <Input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Phone
                </Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Company
                </Label>
                <Input
                  value={editForm.company}
                  onChange={(e) =>
                    setEditForm({ ...editForm, company: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Title
                </Label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  LinkedIn
                </Label>
                <Input
                  value={editForm.linkedin}
                  onChange={(e) =>
                    setEditForm({ ...editForm, linkedin: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Source
                </Label>
                <Select
                  value={editForm.source}
                  onValueChange={(v) => setEditForm({ ...editForm, source: v })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Campaign
                </Label>
                <Input
                  value={editForm.campaign_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, campaign_name: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Response Date
                </Label>
                <Input
                  type="date"
                  value={editForm.response_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, response_date: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Status
                </Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Owner
                </Label>
                <Select
                  value={editForm.owner_id || "none"}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      owner_id: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 rounded-sm mt-1">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {team.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  Response Summary
                </Label>
                <Textarea
                  rows={3}
                  value={editForm.response_summary}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      response_summary: e.target.value,
                    })
                  }
                  className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
