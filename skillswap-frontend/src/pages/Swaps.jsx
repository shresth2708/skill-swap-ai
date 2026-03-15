import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRightLeft, Inbox, CheckCircle2, Clock, XCircle, LayoutList } from 'lucide-react';
import SwapCard from '../components/SwapCard';
import { useSwap } from '../hooks/useSwap';
import { ROUTES } from '../constants/routes';

const statusTabs = [
  { value: 'all', label: 'All', icon: LayoutList },
  { value: 'ACTIVE', label: 'Active', icon: ArrowRightLeft },
  { value: 'PENDING', label: 'Pending', icon: Clock },
  { value: 'ACCEPTED', label: 'Accepted', icon: CheckCircle2 },
  { value: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  { value: 'CANCELLED', label: 'Cancelled', icon: XCircle },
];

const Swaps = () => {
  const { swaps, activeSwaps, swapStats, isLoading } = useSwap();
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');

  // Merge active + all swaps, deduplicate by id
  const allSwaps = useMemo(() => {
    const safeSwaps = Array.isArray(swaps) ? swaps : [];
    const safeActive = Array.isArray(activeSwaps) ? activeSwaps : [];
    const merged = [...safeActive, ...safeSwaps];
    const seen = new Set();
    return merged.filter((s) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [swaps, activeSwaps]);

  const filteredSwaps = useMemo(() => {
    let list = allSwaps;

    // Filter by status tab
    if (activeTab !== 'all') {
      if (activeTab === 'ACTIVE') {
        list = list.filter((s) => {
          const st = s.status?.toUpperCase();
          return st === 'ACTIVE' || st === 'IN_PROGRESS';
        });
      } else {
        list = list.filter((s) => s.status?.toUpperCase() === activeTab);
      }
    }

    // Filter by search query
    if (query.trim()) {
      const needle = query.toLowerCase();
      list = list.filter((s) => JSON.stringify(s).toLowerCase().includes(needle));
    }

    return list;
  }, [allSwaps, activeTab, query]);

  // Compute counts per status
  const counts = useMemo(() => {
    const c = { all: allSwaps.length, ACTIVE: 0, PENDING: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 };
    allSwaps.forEach((s) => {
      const status = s.status?.toUpperCase();
      if (status === 'IN_PROGRESS') {
        c.ACTIVE++;
      } else if (status && c[status] !== undefined) {
        c[status]++;
      }
    });
    return c;
  }, [allSwaps]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Swaps</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Your Skill Exchanges</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Track every swap from first connection to completed exchange. Schedule sessions, chat, and leave reviews — all in one place.
            </p>
          </div>

          <div className="grid gap-3 flex-1 lg:max-w-md w-full">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search swaps..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="mt-6 border-b border-white/10 flex gap-4 overflow-x-auto">
          {statusTabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {tab.label}
                <span className={`ml-1 text-[10px] rounded-full px-2 py-0.5 ${isActive ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/5 text-white/40'}`}>
                  {counts[tab.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Stats Row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Total Swaps</p>
          <p className="mt-3 text-3xl font-semibold text-white">{counts.all}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Active</p>
          <p className="mt-3 text-3xl font-semibold text-cyan-300">{counts.ACTIVE + counts.ACCEPTED}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">{swapStats?.completedSwaps ?? counts.COMPLETED}</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-amber-300">{counts.PENDING}</p>
        </article>
      </section>

      {/* Swap Cards Grid */}
      <section className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
            Loading your swaps...
          </div>
        ) : filteredSwaps.length === 0 ? (
          <div className="col-span-full rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-12 text-center">
            <Inbox className="h-10 w-10 text-white/15 mx-auto mb-4" />
            <p className="text-sm text-white/50">
              {activeTab === 'all'
                ? "No swaps yet. Accept a match to start your first skill exchange!"
                : `No ${activeTab.toLowerCase()} swaps found.`}
            </p>
            {activeTab === 'all' && (
              <Link
                to={ROUTES.matches}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                <ArrowRightLeft className="h-4 w-4" /> Browse Matches
              </Link>
            )}
          </div>
        ) : (
          filteredSwaps.map((swap) => (
            <Link key={swap.id} to={ROUTES.swapDetail(swap.id)} className="block">
              <SwapCard swap={swap} />
            </Link>
          ))
        )}
      </section>
    </div>
  );
};

export default Swaps;
