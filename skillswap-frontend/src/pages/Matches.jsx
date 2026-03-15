import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Search, X, BarChart3, AlertCircle } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import { useMatches } from '../hooks/useMatches';
import { ROUTES } from '../constants/routes';
import { matchAPI, swapAPI, userAPI } from '../services/api.service';

const strategyOptions = [
  { value: 'skill', label: 'Skill-Based' },
  { value: 'location', label: 'Location-Based' },
  { value: 'hybrid', label: 'AI Hybrid' },
];

const ExplainModal = ({ matchId, strategy, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    matchAPI.explainMatch(matchId, strategy ? { strategy } : {}).then((res) => {
      setData(res);
      setLoading(false);
    }).catch(err => {
      setError(err?.message || 'Failed to load explanation');
      setLoading(false);
    });
  }, [matchId, strategy]);

  if (!matchId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
          <BarChart3 className="h-5 w-5 text-cyan-300" />
          <h3 className="text-xl font-semibold text-white">Match Explanation</h3>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-white/50">Computing compatibility factors...</div>
        ) : error ? (
          <div className="py-10 flex flex-col items-center gap-2 text-rose-300 text-sm">
            <AlertCircle className="h-6 w-6" />
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <p className="text-sm text-white/60">Here is the breakdown of why this profile is a suggested match.</p>
            {data.finalScore != null && (
              <p className="text-sm text-cyan-200/90">
                Model score: <span className="font-semibold">{Number(data.finalScore).toFixed(3)}</span> (0–1)
              </p>
            )}
            <div className="space-y-3">
               {(() => {
                 const breakdown = [
                   { label: 'Skill overlap', value: (data.skillOverlapScore ?? 0) * 100, color: 'bg-emerald-400' },
                   { label: 'Reverse', value: (data.reverseScore ?? 0) * 100, color: 'bg-cyan-400' },
                   { label: 'Proficiency', value: (data.proficiencyBonus ?? 0) * 100, color: 'bg-violet-400' },
                   { label: 'Availability', value: (data.availabilityScore ?? 0) * 100, color: 'bg-indigo-400' },
                   { label: 'Rating', value: (data.ratingWeight ?? 0) * 100, color: 'bg-amber-400' },
                 ];
                 const total = breakdown.reduce((acc, curr) => acc + (Number.isFinite(curr.value) ? curr.value : 0), 0) || 1;

                 return (
                   <>
                     <div className="w-full h-4 rounded-full overflow-hidden flex bg-white/5 shadow-inner">
                       {breakdown.map((item, idx) => (
                         <div
                           key={idx}
                           className={`h-full ${item.color} transition-all duration-1000`}
                           style={{ width: `${(item.value / total) * 100}%` }}
                           title={item.label}
                         />
                       ))}
                     </div>
                     <div className="grid grid-cols-2 gap-3 mt-4">
                       {breakdown.map((item, idx) => (
                         <div key={idx} className="flex items-center gap-2 text-sm text-white/70">
                           <span className={`h-3 w-3 rounded-full ${item.color}`} />
                           <span>{item.label} ({Math.round((item.value / total) * 100)}%)</span>
                         </div>
                       ))}
                     </div>
                     {Array.isArray(data.sharedSkills) && data.sharedSkills.length > 0 && (
                       <p className="text-xs text-white/55 pt-2">
                         Aligned skills: {data.sharedSkills.join(', ')}
                       </p>
                     )}
                   </>
                 );
               })()}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 text-right">
               <button onClick={onClose} className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 transition">
                 Close
               </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CreateSwapModal = ({ match, onClose, onCreated }) => {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [offeredOptions, setOfferedOptions] = useState([]);
  const [requestedOptions, setRequestedOptions] = useState([]);
  const [offeredSkillId, setOfferedSkillId] = useState('');
  const [requestedSkillId, setRequestedSkillId] = useState('');
  const [terms, setTerms] = useState('');

  const partnerUserId = match?.matchedUser?.id || match?.user?.id || null;
  const matchId = match?.matchId || match?.id || null;

  useEffect(() => {
    if (!match) return;

    let cancelled = false;

    const loadProfiles = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!partnerUserId) {
          throw new Error('Unable to resolve the matched user for swap creation.');
        }

        const [me, partner] = await Promise.all([
          userAPI.getProfile(),
          userAPI.getPublicProfile(partnerUserId),
        ]);

        if (cancelled) return;

        const myOfferSkills = (me?.skills || []).filter((s) => String(s.type).toLowerCase() === 'offer');
        const partnerOfferSkills = (partner?.skills || []).filter((s) => String(s.type).toLowerCase() === 'offer');

        setOfferedOptions(myOfferSkills);
        setRequestedOptions(partnerOfferSkills);
        setOfferedSkillId(myOfferSkills[0]?.id || '');
        setRequestedSkillId(partnerOfferSkills[0]?.id || '');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load skills for swap creation.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [match, partnerUserId]);

  if (!match) return null;

  const labelForSkill = (entry) => {
    const skillName = entry?.skill?.name || entry?.name || 'Skill';
    const level = entry?.proficiencyLevel || entry?.proficiency || null;
    return level ? `${skillName} (${level})` : skillName;
  };

  const handleCreateSwap = async () => {
    if (!matchId || !offeredSkillId || !requestedSkillId) {
      toast.error('Please select both offered and requested skills.');
      return;
    }

    try {
      setIsSubmitting(true);
      const swap = await swapAPI.createSwap({
        matchId,
        offeredSkillId,
        requestedSkillId,
        terms: terms.trim() || undefined,
      });
      onCreated?.(swap);
    } catch (err) {
      toast.error(err?.message || 'Unable to create swap request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-semibold text-white">Create Swap Request</h3>
        <p className="mt-2 text-sm text-white/55">
          Your match is accepted. Pick the skill you will offer and the one you want to learn.
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
            Loading skill options...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-sm text-rose-200">
            {error}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Skill You Offer</span>
              <select
                value={offeredSkillId}
                onChange={(e) => setOfferedSkillId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
              >
                <option value="">Select offered skill</option>
                {offeredOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {labelForSkill(entry)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Skill You Request</span>
              <select
                value={requestedSkillId}
                onChange={(e) => setRequestedSkillId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
              >
                <option value="">Select requested skill</option>
                {requestedOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {labelForSkill(entry)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Notes/Terms (optional)</span>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                placeholder="Add a short plan or expectations for this swap..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 resize-none"
              />
            </label>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleCreateSwap}
                disabled={isSubmitting}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-95 disabled:opacity-60"
              >
                {isSubmitting ? 'Creating...' : 'Create Swap'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Matches = () => {
  const navigate = useNavigate();
  const [strategy, setStrategy] = useState('skill');
  const [query, setQuery] = useState('');
  const [explainingMatchId, setExplainingMatchId] = useState(null);
  const [createSwapMatch, setCreateSwapMatch] = useState(null);
  const {
    matches,
    stats,
    pagination,
    meta,
    isLoading,
    isStatsLoading,
    acceptMatch,
    declineMatch,
  } = useMatches({ strategy });

  const filteredMatches = useMemo(() => {
    if (!query.trim()) return matches;
    const needle = query.toLowerCase();
    return matches.filter((match) => JSON.stringify(match).toLowerCase().includes(needle));
  }, [matches, query]);

  const handleAccept = async (match) => {
    try {
      await acceptMatch(match.matchId || match.id);
      toast.success('Match accepted. Create a swap request to continue.');
      setCreateSwapMatch(match);
    } catch (error) {
      toast.error(error?.message || 'Unable to accept this match');
    }
  };

  const handleDecline = async (match) => {
    try {
      await declineMatch({ matchId: match.matchId || match.id });
      toast.success('Match declined');
    } catch (error) {
      toast.error(error?.message || 'Unable to decline this match');
    }
  };

  return (
    <div className="space-y-6 relative">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Matches</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Review suggested partners</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">Search and sort through the current suggestions. Accept the best-fit exchange or pass on a profile for now.</p>
          </div>

          <div className="grid gap-3 flex-1 lg:max-w-md w-full">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search matches..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
          </div>
        </div>

        {/* Strategy Tabs */}
        <div className="mt-6 border-b border-white/10 flex gap-6 overflow-x-auto">
          {strategyOptions.map((option) => {
            const isActive = strategy === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setStrategy(option.value)}
                className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                    ? 'border-cyan-400 text-cyan-300' 
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">All-time match records</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {isStatsLoading ? '—' : (stats.totalMatches ?? 0)}
          </p>
          <p className="mt-1 text-xs text-white/40">Every strategy &amp; status (history)</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Shown for this tab</p>
          <p className="mt-3 text-3xl font-semibold text-white">{pagination?.total ?? matches.length}</p>
          <p className="mt-1 text-xs text-white/40">Current strategy, pending only</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Accepted / Declined</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {isStatsLoading
              ? '—'
              : `${stats.acceptedMatches ?? 0} / ${stats.declinedMatches ?? 0}`}
          </p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
          <p className="text-sm text-white/55">Strategy</p>
          <p className="mt-3 text-3xl font-semibold text-cyan-300 capitalize">{strategy}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
            Finding best suited matches for you...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="col-span-full rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-white/50 space-y-2">
            <p>No suggested partners for <span className="text-cyan-200/90 capitalize">{strategy}</span> right now.</p>
            {meta?.message && <p className="text-amber-200/80">{meta.message}</p>}
            <p className="text-xs text-white/40 max-w-md mx-auto">
              The big number above is your all-time match history. This list only shows <strong>pending</strong> suggestions
              for the selected tab. After you finish or cancel a swap, you can be matched (and swap) with the same person again.
            </p>
          </div>
        ) : filteredMatches.map((match, idx) => (
          <MatchCard
            key={match.matchId || match.id || `match-${idx}`}
            match={match}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onExplain={() => setExplainingMatchId(match.matchId || match.id)}
          />
        ))}
      </section>

      {/* Explain Modal */}
      <ExplainModal
        matchId={explainingMatchId}
        strategy={strategy}
        onClose={() => setExplainingMatchId(null)}
      />

      {/* Explicit swap creation flow after match acceptance */}
      <CreateSwapModal
        match={createSwapMatch}
        onClose={() => setCreateSwapMatch(null)}
        onCreated={(swap) => {
          setCreateSwapMatch(null);
          toast.success('Swap request created successfully');
          if (swap?.id) {
            navigate(ROUTES.swapDetail(swap.id));
          }
        }}
      />
    </div>
  );
};

export default Matches;
