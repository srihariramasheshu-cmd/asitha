import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth, API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, User } from "lucide-react";
import axios from "axios";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user && !authLoading) {
    return <Navigate to={user.role === "seat" ? "/dashboard" : "/admin"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);

    try {
      await axios.post(`${API}/auth/signup`, { name, email, password });
      toast.success("Account created!", {
        description: "Please wait for admin approval before logging in.",
      });
      navigate("/login");
    } catch (error) {
      toast.error("Signup failed", {
        description: error.response?.data?.detail || "Unable to create account",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <h1 className="font-chivo font-black text-4xl text-white tracking-tight uppercase">
              ABM Blinder
            </h1>
            <p className="font-mono text-xs text-zinc-500 mt-2 uppercase tracking-widest">
              Create Your Account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="signup-name-input"
                  className="pl-10 bg-zinc-950 border-zinc-800 rounded-sm h-12 font-manrope text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

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
                  data-testid="signup-email-input"
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
                  data-testid="signup-password-input"
                  className="pl-10 bg-zinc-950 border-zinc-800 rounded-sm h-12 font-mono text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="signup-confirm-password-input"
                  className="pl-10 bg-zinc-950 border-zinc-800 rounded-sm h-12 font-mono text-sm text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="signup-submit-btn"
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-bold tracking-wide btn-glow transition-all duration-150 active:scale-95"
            >
              {loading ? (
                <span className="font-mono">Creating Account...</span>
              ) : (
                <>
                  <span>Sign Up</span>
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Login link */}
          <p className="mt-8 font-mono text-xs text-zinc-500 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-400 hover:text-blue-300">
              Sign In
            </Link>
          </p>

          {/* Info */}
          <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-sm">
            <p className="font-mono text-[10px] text-zinc-400 leading-relaxed">
              After signup, an admin will review and approve your account. 
              You'll be notified when you can log in.
            </p>
          </div>
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-emerald-600/10 border border-emerald-600/20 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest">
                Join The Team
              </span>
            </div>
            
            <h2 className="font-chivo font-black text-5xl text-white leading-tight uppercase tracking-tight">
              Start Your<br />
              Outbound<br />
              Journey
            </h2>
            
            <p className="font-manrope text-zinc-400 mt-6 text-lg leading-relaxed">
              Create your account and get started with precision outbound campaigns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
