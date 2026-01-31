import Sidebar from "./Sidebar";

export const MainLayout = ({ children, title, subtitle, actions }) => {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-lg">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="font-chivo font-bold text-2xl text-white tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="font-mono text-xs text-zinc-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
