import { Link, NavLink, Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analyze", label: "Analyze" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Voice Profile" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? "bg-emerald-500/10 text-emerald-400"
      : "text-slate-300 hover:text-emerald-400"
  }`;

/**
 * Main application shell. No authentication — the app opens directly to the
 * dashboard.
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <span className="text-xl font-bold tracking-tight">VoiceShield</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
