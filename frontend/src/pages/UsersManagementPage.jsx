import { useState, useEffect } from "react";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  UserCheck,
  UserX,
  Shield,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  Trash2,
  Crown
} from "lucide-react";
import { toast } from "sonner";

export default function UsersManagementPage() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [approving, setApproving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("seat");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pendingRes, allRes] = await Promise.all([
        axios.get(`${API}/users/pending`),
        axios.get(`${API}/users/all-details`)
      ]);
      setPendingUsers(pendingRes.data);
      setAllUsers(allRes.data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, role) => {
    setApproving(true);
    try {
      await axios.put(`${API}/users/${userId}/approve`, { role });
      toast.success(`User approved as ${role}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve user");
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm("Delete this user permanently?")) return;
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success("User deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update role");
    }
  };

  const togglePassword = (userId) => {
    setShowPassword(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case "super_admin": return <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">Super Admin</Badge>;
      case "admin": return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">Admin</Badge>;
      case "seat": return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Seat</Badge>;
      case "pending": return <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">Pending</Badge>;
      default: return <Badge>{role}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Active</Badge>;
      case "pending_approval": return <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">Pending</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <MainLayout title="Users Management">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading users...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Users Management"
      subtitle={`${pendingUsers.length} pending approval • ${allUsers.length} total users`}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-1 mb-6">
          <TabsTrigger 
            value="pending" 
            className="rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            <Clock size={14} className="mr-2" />
            Pending Approval ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger 
            value="all" 
            className="rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            <Users size={14} className="mr-2" />
            All Users ({allUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending">
          {pendingUsers.length === 0 ? (
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
              <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" strokeWidth={1} />
              <p className="font-manrope text-zinc-400 text-lg">No pending approvals</p>
              <p className="font-mono text-xs text-zinc-600 mt-2">
                New user signups will appear here
              </p>
            </Card>
          ) : (
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Signed Up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((u) => (
                    <TableRow key={u.id} data-testid={`pending-user-${u.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-sm bg-amber-600/20 flex items-center justify-center">
                            <span className="font-chivo font-bold text-sm text-amber-400">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-manrope text-white">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-zinc-400">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-zinc-300">
                            {showPassword[u.id] ? u.plain_password : "••••••••"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePassword(u.id)}
                            className="text-zinc-500 hover:text-white"
                          >
                            {showPassword[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-24 h-8 bg-zinc-800 border-zinc-700 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                              <SelectItem value="seat">Seat</SelectItem>
                              {user?.role === "super_admin" && (
                                <SelectItem value="admin">Admin</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(u.id, selectedRole)}
                            disabled={approving}
                            data-testid={`approve-user-${u.id}`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm"
                          >
                            <UserCheck size={14} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(u.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <UserX size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* All Users Tab */}
        <TabsContent value="all">
          <Card className="bg-zinc-900/50 border border-white/5 rounded-sm overflow-hidden">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                          u.role === "admin" ? "bg-blue-600" : "bg-emerald-600"
                        }`}>
                          <span className="font-chivo font-bold text-sm text-white">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-manrope text-white">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-zinc-400">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-zinc-300">
                          {showPassword[u.id] ? u.plain_password : "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePassword(u.id)}
                          className="text-zinc-500 hover:text-white"
                        >
                          {showPassword[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell>{getStatusBadge(u.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user?.role === "super_admin" && u.status === "active" && (
                          <Select 
                            value={u.role}
                            onValueChange={(val) => handleChangeRole(u.id, val)}
                          >
                            <SelectTrigger className="w-24 h-8 bg-zinc-800 border-zinc-700 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                              <SelectItem value="seat">Seat</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(u.id)}
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
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
