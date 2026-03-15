import { CalendarClock, CircleCheckBig, CircleX, Hourglass, MessageSquareMore, ArrowRightLeft } from 'lucide-react';
import { formatDateTime, truncateText } from '../utils/formatters';

const statusTone = {
  PENDING: 'bg-amber-400/15 text-amber-200 border-amber-400/20',
  ACCEPTED: 'bg-cyan-400/15 text-cyan-100 border-cyan-400/20',
  IN_PROGRESS: 'bg-violet-400/15 text-violet-100 border-violet-400/20',
  COMPLETED: 'bg-emerald-400/15 text-emerald-100 border-emerald-400/20',
  CANCELLED: 'bg-rose-400/15 text-rose-100 border-rose-400/20',
  EXPIRED: 'bg-slate-400/15 text-slate-100 border-slate-400/20',
};

const statusIcon = {
  PENDING: Hourglass,
  ACCEPTED: CircleCheckBig,
  IN_PROGRESS: MessageSquareMore,
  COMPLETED: CircleCheckBig,
  CANCELLED: CircleX,
  EXPIRED: CircleX,
};

/**
 * Resolve a display name from a swap participant object.
 * The API may nest it under `profile.displayName` or directly as `displayName`.
 */
const getName = (user) => {
  if (!user) return null;
  return (
    user.profile?.displayName ||
    user.displayName ||
    user.name ||
    user.email?.split('@')[0] ||
    null
  );
};

const SwapCard = ({ swap, onClick }) => {
  const StatusIcon = statusIcon[swap?.status] || Hourglass;

  const initiatorName = getName(swap?.initiator);
  const receiverName = getName(swap?.receiver);

  // Build a descriptive title from participant names
  const title = (initiatorName && receiverName)
    ? `${initiatorName} ↔ ${receiverName}`
    : swap?.title || swap?.match?.title || 'Swap request';

  // Show skill names if available
  const offeredSkillName = swap?.offeredSkill?.skill?.name;
  const requestedSkillName = swap?.requestedSkill?.skill?.name;

  return (
    <button
      type="button"
      onClick={() => onClick?.(swap)}
      className="group w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:bg-white/[0.075]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{title}</p>
          {offeredSkillName && requestedSkillName ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-white/55">
              <span className="text-cyan-300">{offeredSkillName}</span>
              <ArrowRightLeft className="h-3 w-3 text-white/30" />
              <span className="text-emerald-300">{requestedSkillName}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/55">
              {truncateText(swap?.terms || swap?.notes || 'A practical exchange in progress.', 100)}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${statusTone[swap?.status] || statusTone.PENDING}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {swap?.status || 'PENDING'}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2">
          <CalendarClock className="h-4 w-4 text-cyan-300" />
          {formatDateTime(swap?.scheduledAt || swap?.createdAt)}
        </span>
        {swap?.match?.compatibilityScore !== undefined && (
          <span className="rounded-full bg-white/5 px-3 py-2">
            Score {swap.match.compatibilityScore}
          </span>
        )}
      </div>
    </button>
  );
};

export default SwapCard;
