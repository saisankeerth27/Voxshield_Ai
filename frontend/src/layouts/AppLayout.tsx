import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, ShieldCheck, X } from "lucide-react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analyze", label: "Analyze" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Speaker Profile" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? "bg-emerald-500/10 text-emerald-400"
      : "text-slate-300 hover:text-emerald-400"
  }`;

/**
 * Main application shell. No authentication — the app opens directly.
 * The logo always returns to the home page.
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

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

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex items-center rounded-md p-2 text-slate-300 transition-colors hover:text-emerald-400 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <nav className="mx-auto max-w-7xl px-4 pb-3 md:hidden">
            <div className="flex flex-col gap-1 rounded-lg border border-white/5 bg-surface-light p-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClass}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}