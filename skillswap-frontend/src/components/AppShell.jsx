import { Link, NavLink, Outlet } from 'react-router-dom';
import { Bell, LogOut, Search, Sparkles, UserCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import NotifBell from './NotifBell';

const navLinkClass = ({ isActive }) => [
  'rounded-full px-4 py-2 text-sm font-medium transition',
  isActive ? 'bg-white text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-white/70 hover:bg-white/10 hover:text-white',
].join(' ');

const AppShell = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#0b1220_44%,_#09111c_100%)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to={ROUTES.dashboard} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.24em] text-cyan-300 uppercase">SkillSwap AI</p>
              <p className="text-xs text-white/55">Find your next learning exchange</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
            <NavLink to={ROUTES.dashboard} className={navLinkClass} end>Dashboard</NavLink>
            <NavLink to={ROUTES.matches} className={navLinkClass}>Matches</NavLink>
            <NavLink to={ROUTES.swaps} className={navLinkClass}>Swaps</NavLink>
            <NavLink to={ROUTES.profile} className={navLinkClass}>Profile</NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <NotifBell />
            <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 lg:flex">
              <UserCircle2 className="h-4 w-4 text-cyan-300" />
              <span>{user?.displayName || user?.name || user?.email || 'Member'}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-rose-500/15 hover:text-rose-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 text-xs text-white/40 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span>Built for live skill exchanges, fast matching, and clean follow-through.</span>
          <span className="hidden items-center gap-2 md:flex"><Search className="h-3.5 w-3.5" /> Find, swap, learn</span>
        </div>
      </footer>
    </div>
  );
};

export default AppShell;
