import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/App";
import MainLayout from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Building, 
  User, 
  Mail, 
  Phone,
  Linkedin,
  Globe,
  Briefcase,
  Save,
  Send,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";

const OUTREACH_STEPS = [
  { number: 1, label: "Intro Email" },
  { number: 2, label: "Follow-up 1" },
  { number: 3, label: "Follow-up 2" },
  { number: 4, label: "Follow-up 3" },
];

export default function ProspectDetailPage() {
  const { prospectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [prospect, setProspect] = useState(null);
  const [outreachSteps, setOutreachSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSteps, setEditedSteps] = useState({});
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    fetchData();
  }, [prospectId]);

  const fetchData = async () => {
    try {
      const [prospectRes, stepsRes] = await Promise.all([
        axios.get(`${API}/prospects/${prospectId}`),
        axios.get(`${API}/outreach-steps/${prospectId}`)
      ]);
      setProspect(prospectRes.data);
      setOutreachSteps(stepsRes.data);
      
      // Initialize edited steps from existing data
      const stepsMap = {};
      stepsRes.data.forEach(step => {
        stepsMap[step.step_number] = { subject: step.subject, body: step.body };
      });
      setEditedSteps(stepsMap);
    } catch (error) {
      toast.error("Failed to load prospect");
      navigate("/prospects");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep = async (stepNumber) => {
    const stepData = editedSteps[stepNumber];
    if (!stepData?.subject || !stepData?.body) {
      toast.error("Subject and body are required");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/outreach-steps`, {
        prospect_id: prospectId,
        step_number: stepNumber,
        subject: stepData.subject,
        body: stepData.body
      });
      toast.success(`Step ${stepNumber} saved`);
      fetchData();
    } catch (error) {
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  };

  const updateStepField = (stepNumber, field, value) => {
    setEditedSteps(prev => ({
      ...prev,
      [stepNumber]: {
        ...prev[stepNumber],
        [field]: value
      }
    }));
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      new: "status-new",
      replied: "status-replied",
      sent: "status-sent",
    };
    const baseClass = Object.keys(statusClasses).find(k => status?.includes(k)) || "new";
    return statusClasses[baseClass] || "status-new";
  };

  if (loading) {
    return (
      <MainLayout title="Prospect Details">
        <div className="flex items-center justify-center h-64">
          <p className="font-mono text-zinc-500">Loading prospect...</p>
        </div>
      </MainLayout>
    );
  }

  if (!prospect) return null;

  return (
    <MainLayout 
      title={prospect.company_name}
      subtitle={`${prospect.contact_name} • ${prospect.email}`}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate("/prospects")}
          className="border-zinc-700 text-zinc-300"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Prospects
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900/50 border border-zinc-800 rounded-sm p-1 mb-6">
          <TabsTrigger 
            value="info" 
            className="rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Prospect Info
          </TabsTrigger>
          <TabsTrigger 
            value="outreach" 
            className="rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Outreach Sequence
          </TabsTrigger>
        </TabsList>

        {/* Prospect Info Tab */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <Card className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <h3 className="font-chivo font-bold text-lg text-white mb-6">Contact Information</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Building size={12} />
                    Company
                  </Label>
                  <p className="font-manrope text-white">{prospect.company_name}</p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <User size={12} />
                    Contact Name
                  </Label>
                  <p className="font-manrope text-white">{prospect.contact_name}</p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Mail size={12} />
                    Email
                  </Label>
                  <p className="font-mono text-sm text-blue-400">{prospect.email}</p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Phone size={12} />
                    Phone
                  </Label>
                  <p className="font-mono text-sm text-zinc-300">{prospect.phone || "—"}</p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Briefcase size={12} />
                    Title
                  </Label>
                  <p className="font-manrope text-zinc-300">{prospect.title || "—"}</p>
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Linkedin size={12} />
                    LinkedIn
                  </Label>
                  {prospect.linkedin ? (
                    <a 
                      href={prospect.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-400 hover:underline"
                    >
                      View Profile
                    </a>
                  ) : (
                    <p className="font-mono text-sm text-zinc-500">—</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
                    <Globe size={12} />
                    Sending Domain
                  </Label>
                  <p className="font-mono text-sm text-zinc-300">{prospect.domain || "Not assigned"}</p>
                </div>
              </div>

              {/* Custom Fields */}
              {Object.keys(prospect.custom_fields || {}).length > 0 && (
                <div className="mt-8 pt-6 border-t border-zinc-800">
                  <h4 className="font-chivo font-bold text-sm text-zinc-400 mb-4">Custom Fields</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(prospect.custom_fields).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                          {key}
                        </Label>
                        <p className="font-mono text-sm text-zinc-300">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Status Card */}
            <Card className="bg-zinc-900/50 border border-white/5 rounded-sm p-6">
              <h3 className="font-chivo font-bold text-lg text-white mb-4">Status</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Current Status
                  </Label>
                  <div className="mt-2">
                    <span className={`font-mono text-sm px-3 py-1.5 rounded-sm ${getStatusBadge(prospect.status)}`}>
                      {prospect.status}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Created
                  </Label>
                  <p className="font-mono text-sm text-zinc-400 mt-1">
                    {new Date(prospect.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Outreach Steps
                  </Label>
                  <p className="font-mono text-sm text-zinc-400 mt-1">
                    {outreachSteps.length} / 4 configured
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Outreach Sequence Tab */}
        <TabsContent value="outreach">
          <div className="space-y-4">
            <p className="font-manrope text-zinc-400 mb-6">
              Configure your 4-step outreach sequence for this prospect. Each step can have a unique subject and body.
            </p>

            {OUTREACH_STEPS.map((step) => {
              const existingStep = outreachSteps.find(s => s.step_number === step.number);
              const currentData = editedSteps[step.number] || { subject: "", body: "" };
              
              return (
                <Card 
                  key={step.number}
                  data-testid={`outreach-step-${step.number}`}
                  className="bg-zinc-900/50 border border-white/5 rounded-sm p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                        existingStep 
                          ? "bg-emerald-600/10 border border-emerald-600/20" 
                          : "bg-zinc-800 border border-zinc-700"
                      }`}>
                        <span className={`font-chivo font-bold text-sm ${
                          existingStep ? "text-emerald-500" : "text-zinc-500"
                        }`}>
                          {step.number}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-chivo font-bold text-white">{step.label}</h4>
                        {existingStep && (
                          <p className="font-mono text-[10px] text-zinc-500">
                            Last updated: {new Date(existingStep.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleSaveStep(step.number)}
                      disabled={saving}
                      data-testid={`save-step-${step.number}`}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm"
                    >
                      <Save size={14} className="mr-2" />
                      Save
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        Subject Line
                      </Label>
                      <Input
                        value={currentData.subject}
                        onChange={(e) => updateStepField(step.number, "subject", e.target.value)}
                        placeholder="Enter email subject..."
                        className="bg-zinc-950 border-zinc-800 rounded-sm font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        Email Body
                      </Label>
                      <Textarea
                        value={currentData.body}
                        onChange={(e) => updateStepField(step.number, "body", e.target.value)}
                        placeholder="Enter email body..."
                        className="bg-zinc-950 border-zinc-800 rounded-sm font-manrope min-h-[150px] resize-none"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
