import { ArrowRightLeft, Info, MapPin, Sparkles, Star, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

const CircularProgress = ({ value, label }) => {
  const n = Number(value);
  const clamped = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  const displayPct = Math.round(clamped);

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950/50">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/10" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-cyan-400"
          strokeWidth="4"
          strokeDasharray={`${displayPct} 100`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex max-w-[2.5rem] flex-col items-center justify-center text-center">
        <span className="text-[9px] uppercase leading-none text-cyan-200/80">{label}</span>
        <span className="font-bold leading-tight text-white tabular-nums text-sm">{displayPct}%</span>
      </div>
    </div>
  );
};

const MatchCard = ({ match, onAccept, onDecline, onExplain, compact = false }) => {
  const userObj = match?.matchedUser || match?.user || match || {};
  const profile = userObj?.profile || userObj;
  
  const displayName = profile?.displayName || profile?.name || userObj?.displayName || userObj?.name || (userObj?.email?.split('@')[0]) || 'Matched Partner';
  const location = profile?.location || userObj?.location || 'Remote friendly';
  const bio = profile?.bio ?? userObj?.bio;
  const rating = userObj?.avgRating || match?.avgRating;
  const avatarUrl = profile?.avatarUrl || userObj?.avatarUrl;
  const userId = userObj?.id || match?.userId || match?.matchId || match?.id || null;
  
  let score = match?.score ?? match?.compatibilityScore ?? match?.matchScore ?? null;
  if (score !== null && score !== undefined) {
    let pct = Number(score);
    if (Number.isFinite(pct) && pct > 0 && pct <= 1) {
      pct *= 100;
    }
    score = Number.isFinite(pct) ? Math.round(pct) : null;
  }

  let offers = match?.offeredSkills || match?.skillsOffered || match?.skills?.offered || [];
  let wants = match?.wantedSkills || match?.skillsWanted || match?.skills?.wanted || [];

  // Fallback to extract from raw Prisma user skills array if available
  if (offers.length === 0 && wants.length === 0 && userObj?.skills) {
    offers = userObj.skills
      .filter((s) => {
        const type = String(s.type || '').toLowerCase();
        return type === 'teach' || type === 'offer';
      })
      .map((s) => s.skill?.name || s.name)
      .filter(Boolean);
    wants = userObj.skills
      .filter((s) => {
        const type = String(s.type || '').toLowerCase();
        return type === 'learn' || type === 'want';
      })
      .map((s) => s.skill?.name || s.name)
      .filter(Boolean);
  }

  return (
    <article className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 ${compact ? 'p-4' : 'p-5'} shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:bg-white/[0.075] flex flex-col`}>
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-emerald-400/10 opacity-0 transition group-hover:opacity-100" />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-bold text-lg">
                {displayName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-white leading-tight">{displayName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                {location}
              </span>
              {rating != null && (
                <span className="flex items-center gap-1 text-amber-300/80">
                  <Star className="h-3.5 w-3.5 fill-amber-300/80" />
                  {Number(rating).toFixed(1)}
                </span>
              )}
            </div>
            {bio && (
              <p className="mt-2 line-clamp-2 text-xs text-white/50 leading-relaxed" title={bio}>
                {bio}
              </p>
            )}
          </div>
        </div>
        
        {score !== null && score !== undefined && (
           <CircularProgress value={score} label="Match" />
        )}
      </div>

      {!compact && (
        <div className="relative mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] flex-1">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80 mb-2">They offer (You want)</p>
            <div className="flex flex-wrap gap-1.5">
              {offers.length > 0 ? offers.map((item, idx) => (
                <span key={idx} className="bg-emerald-400/10 text-emerald-300/90 border border-emerald-400/20 px-2 py-1 rounded text-xs">
                  {typeof item === 'string' ? item : (item.name || item.title)}
                </span>
              )) : (
                <span className="text-xs text-white/40">Flexible skills</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-center text-cyan-500/50">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-300/80 mb-2">They want (You offer)</p>
            <div className="flex flex-wrap gap-1.5">
              {wants.length > 0 ? wants.map((item, idx) => (
                <span key={idx} className="bg-indigo-400/10 text-indigo-300/90 border border-indigo-400/20 px-2 py-1 rounded text-xs">
                  {typeof item === 'string' ? item : (item.name || item.title)}
                </span>
              )) : (
                <span className="text-xs text-white/40">Open to matching</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`relative ${compact ? 'mt-4' : 'mt-5 pt-4 border-t border-white/10'} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          {!compact && onExplain && (
            <button
              type="button"
              onClick={() => onExplain(match)}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 h-9 w-9 text-white/55 transition hover:bg-white/10 hover:text-white"
              title="See Why"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          {!compact && (
            userId ? (
              <Link
                to={ROUTES.publicProfile(userId)}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 h-9 w-9 text-white/55 transition hover:bg-white/10 hover:text-white"
                title="View Profile"
              >
                <UserPlus className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 h-9 w-9 text-white/30">
                <UserPlus className="h-4 w-4" />
              </span>
            )
          )}
          {compact && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/50">
              <Sparkles className="h-3 w-3 text-cyan-300" /> Curated
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(onDecline && !compact) && (
            <button
              type="button"
              onClick={() => onDecline?.(match)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-rose-500/15 hover:text-rose-100"
            >
              Pass
            </button>
          )}
          {onAccept && (
            <button
              type="button"
              onClick={() => onAccept?.(match)}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-95"
            >
              Accept Match
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default MatchCard;
