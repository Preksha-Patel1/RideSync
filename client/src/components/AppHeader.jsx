import { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut, User, ChevronDown, Menu, X } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { initials } from "../utils/format";

export default function AppHeader({ links, basePath }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link to={basePath}>
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-3 hover:bg-slate-50"
              aria-expanded={menuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                {initials(user?.name) || <User className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm font-semibold text-slate-700">{user?.name?.split(" ")[0]}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft">
                <Link
                  to={`${basePath}/profile`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 md:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 px-5 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2.5 text-sm font-semibold ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-600"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to={`${basePath}/profile`}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-600"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold text-rose-600"
            >
              Log out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
