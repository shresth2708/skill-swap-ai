import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Globe2, Sparkles, Star, Users, Video, Workflow } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMatches } from '../hooks/useMatches';
import { useSwap } from '../hooks/useSwap';
import MatchCard from '../components/MatchCard';
import SwapCard from '../components/SwapCard';
import { ROUTES } from '../constants/routes';
import { formatCount, formatDateTime } from '../utils/formatters';

const renderStatIcon = (iconName) => {
  switch (iconName) {
    case 'workflow':
      return <Workflow className="h-5 w-5 text-cyan-300" />;
    case 'users':
      return <Users className="h-5 w-5 text-indigo-300" />;
    case 'star':
      return <Star className="h-5 w-5 text-amber-300" />;
    case 'sparkles':
    default:
      return <Sparkles className="h-5 w-5 text-emerald-300" />;
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const { matches, stats: matchStats, isLoading: matchesLoading } = useMatches({ limit: 4 });
  const { activeSwaps, swapStats, upcomingSessions, isLoading: swapsLoading } = useSwap();
  const pendingRequests = matchStats?.pendingMatches
    ?? Math.max(
      (matchStats?.totalMatches ?? matches.length)
        - (matchStats?.acceptedMatches ?? 0)
        - (matchStats?.declinedMatches ?? 0),
      0,
    );

  const resolveSessionPartner = (session) => {
    const fallbackPartner = session.partner || null;
    const initiator = session?.swap?.initiator;
    const receiver = session?.swap?.receiver;

    if (!user?.id) return fallbackPartner || initiator || receiver;
    if (initiator?.id === user.id) return receiver || fallbackPartner;
    if (receiver?.id === user.id) return initiator || fallbackPartner;
    return fallbackPartner || initiator || receiver;
  };

  const stats = [
    { label: 'Active Swaps', value: activeSwaps.length, note: 'In progress exchanges', icon: 'workflow', color: 'from-cyan-500/20 to-transparent' },
    { label: 'Pending Requests', value: pendingRequests, note: 'Awaiting your review', icon: 'users', color: 'from-indigo-500/20 to-transparent' },
    { label: 'Completed', value: swapStats?.completed ?? swapStats?.completedSwaps ?? 0, note: 'Total finished swaps', icon: 'sparkles', color: 'from-emerald-500/20 to-transparent' },
    { label: 'Avg Rating', value: user?.avgRating != null ? Number(user.avgRating).toFixed(1) : '—', note: 'Based on feedback', icon: 'star', color: 'from-amber-500/20 to-transparent' },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 text-sm text-cyan-200/80">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 font-medium">
              <Sparkles className="h-4 w-4" />
              AI matching is live
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-white/65">
              <Globe2 className="h-4 w-4 text-emerald-300" />
              Real-time coordination
            </span>
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Good to see you, {user?.displayName || user?.name || 'there'}.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Today’s workspace keeps match discovery, swaps, chat, and notifications in one focused flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={ROUTES.matches} className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
              Review matches <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={ROUTES.profile} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              Update profile
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Upcoming Sessions</p>
          <div className="mt-4 flex-1 space-y-3">
            {!upcomingSessions || upcomingSessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/50 h-full flex flex-col items-center justify-center text-center">
                <Calendar className="h-6 w-6 text-white/20 mb-2" />
                No sessions scheduled for the next 7 days.
              </div>
            ) : upcomingSessions.slice(0, 3).map((session) => {
              const partner = resolveSessionPartner(session);
              return (
              <div key={session.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">{partner?.profile?.displayName || partner?.displayName || partner?.name || partner?.email || 'Partner'}</p>
                  <p className="mt-1 text-xs text-white/55">{formatDateTime(session.scheduledAt)}</p>
                </div>
                {session.meetingUrl || session.meetingLink ? (
                  <a href={session.meetingUrl || session.meetingLink} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300 transition hover:bg-cyan-400/20">
                    <Video className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-xs text-white/30">No link</span>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon, color }) => (
          <article key={label} className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-50`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/55">{label}</p>
                {renderStatIcon(icon)}
              </div>
              <p className="mt-4 text-3xl font-semibold text-white">{typeof value === 'number' ? formatCount(value) : value}</p>
              <p className="mt-1 text-sm text-white/45">{note}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Suggested matches</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Pending Requests</h2>
            </div>
            <Link to={ROUTES.matches} className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">See all</Link>
          </div>

          <div className="mt-5 space-y-4">
            {matchesLoading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">Loading requests...</div>
            ) : matches.slice(0, 3).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">No pending matches. Discovery awaits!</div>
            ) : matches.slice(0, 3).map((match, idx) => <MatchCard key={match.matchId || match.id || `match-${idx}`} match={match} compact />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Active swaps</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">What’s in motion now</h2>
            </div>
            <Link to={ROUTES.matches} className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">Open queue</Link>
          </div>

          <div className="mt-5 space-y-4">
            {swapsLoading ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">Loading swaps...</div>
            ) : activeSwaps.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-white/50">No active swaps yet.</div>
            ) : activeSwaps.slice(0, 3).map((swap) => (
               <Link key={swap.id} to={ROUTES.swapDetail(swap.id)} className="block">
                 <SwapCard swap={swap} />
               </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
