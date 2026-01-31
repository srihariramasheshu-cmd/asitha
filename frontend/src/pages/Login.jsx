import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user && !authLoading) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      toast.success("Welcome back!", {
        description: `Logged in as ${loggedUser.name}`,
      });
      navigate(["admin", "super_admin"].includes(loggedUser.role) ? "/admin" : "/dashboard");
    } catch (error) {
      toast.error("Login failed", {
        description: error.response?.data?.detail || "Invalid credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <h1 className="font-chivo font-black text-4xl text-white tracking-tight uppercase">
              ABM Blinder
            </h1>
            <p className="font-mono text-xs text-zinc-500 mt-2 uppercase tracking-widest">
              Outbound Campaign Control
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className="pl-10 bg-zinc-950 border-zinc-800 rounded-sm h-12 font-mono text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="pl-10 bg-zinc-950 border-zinc-800 rounded-sm h-12 font-mono text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-bold tracking-wide btn-glow transition-all duration-150 active:scale-95"
            >
              {loading ? (
                <span className="font-mono">Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Login link */}
          <p className="mt-8 font-mono text-xs text-zinc-500 text-center">
            Don't have an account?{" "}
            <a href="/signup" className="text-blue-400 hover:text-blue-300">
              Sign Up
            </a>
          </p>
          
          <p className="mt-2 font-mono text-xs text-zinc-600 text-center">
            Contact your admin if you don't have access
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
        <div className="absolute inset-0 scanlines opacity-50" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-16">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-blue-600/10 border border-blue-600/20 mb-6">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-mono text-[10px] text-blue-400 uppercase tracking-widest">
                System Active
              </span>
            </div>
            
            <h2 className="font-chivo font-black text-5xl text-white leading-tight uppercase tracking-tight">
              Precision<br />
              Outbound<br />
              Control
            </h2>
            
            <p className="font-manrope text-zinc-400 mt-6 text-lg leading-relaxed">
              Orchestrate multi-seat campaigns with surgical precision. 
              Track every touchpoint. Close more deals.
            </p>

            {/* Stats preview */}
            <div className="grid grid-cols-3 gap-4 mt-12">
              {[
                { label: "Active Seats", value: "15" },
                { label: "Projects", value: "∞" },
                { label: "Uptime", value: "99.9%" },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <p className="font-chivo font-black text-2xl text-white">{stat.value}</p>
                  <p className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
