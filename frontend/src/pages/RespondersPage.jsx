import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Inbox,
  ArrowRight,
  Trash2,
  Clock,
  Mail,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_BADGE,
  SOURCE_BADGE,
  STATUSES,
  SOURCES,
  STATUS_LABEL,
  SOURCE_LABEL,
} from "@/lib/crmStyles";

const emptyForm = {
  full_name: "",
  email: "",
  company: "",
  title: "",
  phone: "",
  linkedin: "",
  source: "smartlead",
  campaign_name: "",
  response_date: new Date().toISOString().slice(0, 10),
  response_summary: "",
  status: "new",
  owner_id: "",
};

export default function RespondersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [responders, setResponders] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;
      if (ownerFilter !== "all") params.owner_id = ownerFilter;
      if (search.trim()) params.search = search.trim();

      const [r, t] = await Promise.all([
        axios.get(`${API}/crm/responders`, { params }),
        axios.get(`${API}/crm/team`),
      ]);
      setResponders(r.data);
      setTeam(t.data);
    } catch (e) {
      toast.error("Failed to load responders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sourceFilter, ownerFilter]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.owner_id) delete payload.owner_id;
      await axios.post(`${API}/crm/responders`, payload);
      toast.success("Responder added");
      setShowCreate(false);
      setForm(emptyForm);
      searchParams.delete("new");
      setSearchParams(searchParams);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add responder");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this responder and all related data?")) return;
    try {
      await axios.delete(`${API}/crm/responders/${id}`);
      toast.success("Responder deleted");
      load();
    } catch (e) {
      toast.error(
        e.response?.data?.detail || "Failed to delete (admin only)"
      );
    }
  };

  return (
    <MainLayout
      title="Responders"
      subtitle={`${responders.length} ${responders.length === 1 ? "person" : "people"} who responded`}
      actions={
        <Button
          data-testid="add-responder-btn"
          onClick={() => setShowCreate(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-bold"
        >
          <Plus size={18} className="mr-2" />
          Add Responder
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            size={18}
          />
          <Input
            placeholder="Search name, email, company, campaign…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="search-responders"
            className="pl-10 bg-zinc-900 border-zinc-800 rounded-sm font-mono"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 rounded-sm">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All owners</SelectItem>
            {team.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <p className="font-mono text-zinc-500">Loading…</p>
        </Card>
      ) : responders.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <Inbox
            size={48}
            className="mx-auto text-zinc-600 mb-4"
            strokeWidth={1}
          />
          <p className="font-manrope text-zinc-300 text-lg">No responders yet</p>
          <p className="font-mono text-xs text-zinc-500 mt-2">
            Add the first person who replied to your campaign.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
          >
            <Plus size={16} className="mr-2" />
            Add Responder
          </Button>
        </Card>
      ) : (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responders.map((r) => (
                <TableRow
                  key={r.id}
                  data-testid={`responder-row-${r.id}`}
                  className="cursor-pointer"
                  onClick={() => navigate(`/crm/responders/${r.id}`)}
                >
                  <TableCell>
                    <div className="font-manrope text-zinc-100">
                      {r.full_name}
                    </div>
                    {r.email && (
                      <div className="flex items-center gap-1 text-zinc-500 font-mono text-[11px] mt-0.5">
                        <Mail size={11} />
                        {r.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building size={14} className="text-zinc-600" />
                      <span className="text-zinc-300">{r.company || "—"}</span>
                    </div>
                    {r.campaign_name && (
                      <div className="text-zinc-500 font-mono text-[11px] mt-0.5">
                        {r.campaign_name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${SOURCE_BADGE[r.source] || ""}`}
                    >
                      {r.source}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${STATUS_BADGE[r.status] || ""}`}
                    >
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-zinc-400">
                      {r.owner_name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.next_followup_at ? (
                      <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                        <Clock size={11} />
                        {r.next_followup_at}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-zinc-600">
                        none
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/crm/responders/${r.id}`)}
                        className="text-zinc-400 hover:text-white"
                      >
                        Open
                        <ArrowRight size={14} className="ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r.id)}
                        className="text-zinc-500 hover:text-red-400"
                        data-testid={`delete-${r.id}`}
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

      {/* Create modal */}
      <Dialog
        open={showCreate}
        onOpenChange={(o) => {
          setShowCreate(o);
          if (!o) {
            searchParams.delete("new");
            setSearchParams(searchParams);
          }
        }}
      >
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Add Responder
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Full Name *
              </Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Jane Doe"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
                data-testid="form-name"
              />
            </div>

            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Email
              </Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Phone
              </Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>

            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Company
              </Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Title
              </Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                LinkedIn URL
              </Label>
              <Input
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/…"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>

            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Source
              </Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm({ ...form, source: v })}
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
                Campaign Name
              </Label>
              <Input
                value={form.campaign_name}
                onChange={(e) =>
                  setForm({ ...form, campaign_name: e.target.value })
                }
                placeholder="e.g. Q2 CAD Outreach"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>

            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Response Date
              </Label>
              <Input
                type="date"
                value={form.response_date}
                onChange={(e) =>
                  setForm({ ...form, response_date: e.target.value })
                }
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
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
                value={form.owner_id || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, owner_id: v === "none" ? "" : v })
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
                Response Summary / Notes
              </Label>
              <Textarea
                value={form.response_summary}
                onChange={(e) =>
                  setForm({ ...form, response_summary: e.target.value })
                }
                rows={3}
                placeholder="What did they say? Any context for the team…"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={submitting}
              data-testid="submit-responder"
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
            >
              {submitting ? "Saving…" : "Add Responder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
