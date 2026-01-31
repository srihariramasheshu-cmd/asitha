import { useAuth } from "@/App";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Target, 
  CalendarClock,
  Upload,
  Download,
  LogOut,
  ChevronRight,
  UserCog,
  Activity,
  Crown
} from "lucide-react";

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const adminNavItems = [
    { path: "/admin", icon: LayoutDashboard, label: "Control Tower" },
    { path: "/admin/users", icon: UserCog, label: "Users & Approvals" },
    { path: "/projects", icon: FolderKanban, label: "Projects" },
    { path: "/admin/seats", icon: Users, label: "Seats" },
    { path: "/prospects", icon: Target, label: "Prospects" },
    { path: "/tasks", icon: CalendarClock, label: "All Tasks" },
    { path: "/admin/activity-logs", icon: Activity, label: "Activity Logs" },
    { path: "/admin/schedule", icon: Upload, label: "Schedule Upload" },
    { path: "/admin/export", icon: Download, label: "Export Data" },
  ];

  const seatNavItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/projects", icon: FolderKanban, label: "My Projects" },
    { path: "/prospects", icon: Target, label: "My Prospects" },
    { path: "/tasks", icon: CalendarClock, label: "My Tasks" },
  ];

  const navItems = ["admin", "super_admin"].includes(user?.role) ? adminNavItems : seatNavItems;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl h-screen fixed left-0 top-0 z-40 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="font-chivo font-black text-xl tracking-tight text-white uppercase">
          ABM Blinder
        </h1>
        <p className="font-mono text-[10px] text-zinc-500 mt-1 uppercase tracking-widest flex items-center gap-1">
          {user?.role === "super_admin" && <Crown size={10} className="text-purple-400" />}
          {user?.role === "super_admin" ? "Super Admin" : user?.role === "admin" ? "Admin" : "Seat Console"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-manrope ${
                isActive(item.path)
                  ? "active bg-zinc-800 text-white border-l-2 border-blue-500"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <item.icon size={18} strokeWidth={1.5} />
              <span>{item.label}</span>
              {isActive(item.path) && (
                <ChevronRight size={14} className="ml-auto text-zinc-500" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center">
            <span className="font-chivo font-bold text-sm text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-manrope text-sm text-white truncate">{user?.name}</p>
            <p className="font-mono text-[10px] text-zinc-500 uppercase">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-sm font-manrope transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
