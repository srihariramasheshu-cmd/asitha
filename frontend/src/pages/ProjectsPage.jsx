import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
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
  Plus, 
  FolderKanban, 
  Users, 
  Target,
  ArrowRight,
  Trash2,
  Settings,
  X
} from "lucide-react";
import { toast } from "sonner";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", domains: "" });
  const [creating, setCreating] = useState(false);

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

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const domains = newProject.domains
        .split(",")
        .map(d => d.trim())
        .filter(d => d);
      
      await axios.post(`${API}/projects`, {
        name: newProject.name,
        description: newProject.description,
        domains
      });
      
      toast.success("Project created successfully");
      setShowCreateModal(false);
      setNewProject({ name: "", description: "", domains: "" });
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm("Are you sure? This will delete all related prospects and tasks.")) return;
    
    try {
      await axios.delete(`${API}/projects/${projectId}`);
      toast.success("Project deleted");
      fetchProjects();
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  if (loading) {
    return (
      <MainLayout title="Projects">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading projects...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Projects"
      subtitle={`${projects.length} ${user?.role === "admin" ? "total" : "assigned"} projects`}
      actions={
        user?.role === "admin" && (
          <Button
            onClick={() => setShowCreateModal(true)}
            data-testid="create-project-btn"
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm btn-glow"
          >
            <Plus size={18} className="mr-2" />
            New Project
          </Button>
        )
      }
    >
      {projects.length === 0 ? (
        <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-12 text-center">
          <FolderKanban size={48} className="mx-auto text-zinc-600 mb-4" strokeWidth={1} />
          <p className="font-manrope text-zinc-400 text-lg">No projects yet</p>
          <p className="font-mono text-xs text-zinc-600 mt-2">
            {user?.role === "admin" 
              ? "Create your first project to get started" 
              : "You haven't been assigned to any projects"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <Card
              key={project.id}
              data-testid={`project-card-${project.id}`}
              className={`card-hover bg-zinc-900/50 border border-white/5 rounded-sm p-6 animate-fade-in animate-delay-${(index % 4 + 1) * 100}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-sm bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                  <FolderKanban size={20} className="text-blue-500" strokeWidth={1.5} />
                </div>
                {user?.role === "admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProject(project.id)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>

              <h3 className="font-chivo font-bold text-lg text-white mb-2 truncate">
                {project.name}
              </h3>
              
              {project.description && (
                <p className="font-manrope text-sm text-zinc-400 mb-4 truncate-2">
                  {project.description}
                </p>
              )}

              {project.domains.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {project.domains.slice(0, 3).map((domain) => (
                    <span
                      key={domain}
                      className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-zinc-800 text-zinc-400"
                    >
                      {domain}
                    </span>
                  ))}
                  {project.domains.length > 3 && (
                    <span className="font-mono text-[10px] text-zinc-500">
                      +{project.domains.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <span className="font-mono text-[10px] text-zinc-500">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Open
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 rounded-sm max-w-md">
          <DialogHeader>
            <DialogTitle className="font-chivo font-bold text-xl text-white">
              Create New Project
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Project Name
              </Label>
              <Input
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                data-testid="project-name-input"
                placeholder="Q1 Outbound Campaign"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Description
              </Label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                data-testid="project-description-input"
                placeholder="Campaign targeting enterprise accounts..."
                className="bg-zinc-950 border-zinc-800 rounded-sm font-manrope resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Sending Domains (comma separated)
              </Label>
              <Input
                value={newProject.domains}
                onChange={(e) => setNewProject({ ...newProject, domains: e.target.value })}
                data-testid="project-domains-input"
                placeholder="company1.com, company2.io"
                className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
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
                data-testid="create-project-submit"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
              >
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
