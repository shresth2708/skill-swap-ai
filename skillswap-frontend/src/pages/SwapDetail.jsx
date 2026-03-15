import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgeCheck, CalendarClock, TimerReset, Video, MessageSquare, Star, X, Clock } from 'lucide-react';
import ChatWindow from '../components/ChatWindow';
import { useSwap } from '../hooks/useSwap';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime } from '../utils/formatters';
import { reviewAPI } from '../services/api.service';

/**
 * Resolve a display name from the swap participant object.
 * The API may nest it under `profile.displayName` or directly as `displayName`.
 */
const getParticipantName = (participant) => {
  if (!participant) return null;
  return (
    participant.profile?.displayName ||
    participant.displayName ||
    participant.name ||
    participant.email?.split('@')[0] ||
    null
  );
};

const swapSteps = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

/** Format Date for `datetime-local` value (local). */
const toDatetimeLocalValue = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SwapDetail = () => {
  const { swapId } = useParams();
  const navigate = useNavigate();
  const {
    swap,
    isLoading,
    acceptSwap,
    cancelSwap,
    markComplete,
    scheduleSession,
    rescheduleSession,
    startSwap,
  } = useSwap(swapId);
  const { messages, sendMessage, deleteMessage, sendTyping, isTyping } = useChat(swapId);
  const { user: currentUser } = useAuth();

  // Determine if the current user is the receiver (only the receiver can accept/decline)
  const isReceiver = currentUser?.id && swap?.receiverId === currentUser.id;
  const isInitiator = currentUser?.id && swap?.initiatorId === currentUser.id;

  // Resolve display names
  const initiatorName = getParticipantName(swap?.initiator);
  const receiverName = getParticipantName(swap?.receiver);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('create'); // 'create' | 'reschedule'
  const [sessionAtLocal, setSessionAtLocal] = useState('');
  const [sessionDurationMins, setSessionDurationMins] = useState(60);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  const handleSubmitReview = async () => {
    if (reviewRating === 0) return toast.error('Please select a rating from 1 to 5 stars.');
    if (reviewComment.length < 20 || reviewComment.length > 500) return toast.error(`Comment must be between 20 and 500 characters. Currently: ${reviewComment.length}`);

    setIsSubmittingReview(true);
    try {
      await reviewAPI.submitReview(swapId, { rating: reviewRating, comment: reviewComment });
      toast.success('Review submitted successfully!');
      setIsReviewModalOpen(false);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Derive current step index
  const currentStepIdx = useMemo(() => {
    if (!swap?.status) return 0;
    if (swap.status === 'CANCELLED') return -1;
    return swapSteps.indexOf(swap.status.toUpperCase());
  }, [swap?.status]);
  const swapSession = swap?.session || (Array.isArray(swap?.sessions) ? swap.sessions[0] : null);

  const openScheduleModal = (mode) => {
    setScheduleMode(mode);
    if (mode === 'reschedule' && swapSession?.scheduledAt) {
      setSessionAtLocal(toDatetimeLocalValue(swapSession.scheduledAt));
    } else {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      setSessionAtLocal(toDatetimeLocalValue(d));
    }
    if (swapSession?.durationMins) {
      setSessionDurationMins(swapSession.durationMins);
    } else {
      setSessionDurationMins(60);
    }
    setSessionNotes(swapSession?.notes || '');
    setScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async () => {
    if (!sessionAtLocal) {
      toast.error('Please choose a date and time for the session.');
      return;
    }
    const scheduled = new Date(sessionAtLocal);
    if (Number.isNaN(scheduled.getTime())) {
      toast.error('Invalid date or time.');
      return;
    }
    if (scheduled.getTime() < Date.now() - 60_000) {
      toast.error('Pick a time in the future.');
      return;
    }
    setIsScheduling(true);
    try {
      const payload = {
        scheduledAt: scheduled.toISOString(),
        durationMins: Math.min(240, Math.max(15, Number(sessionDurationMins) || 60)),
        notes: sessionNotes?.trim() || 'Scheduled from SkillSwap.',
      };
      if (scheduleMode === 'reschedule' && swapSession?.id) {
        await rescheduleSession({
          id: swapId,
          sessionId: swapSession.id,
          payload: { scheduledAt: payload.scheduledAt },
        });
        toast.success('Session rescheduled');
      } else {
        await scheduleSession({ id: swapId, payload });
        toast.success('Session scheduled');
      }
      setScheduleModalOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Unable to save session time');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleAccept = async () => {
    try {
      await acceptSwap(swapId);
      toast.success('Swap accepted');
    } catch (error) {
      toast.error(error?.message || 'Unable to accept swap');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSwap({ id: swapId, reason: 'Cancelled from frontend detail screen.' });
      toast.success('Swap cancelled');
    } catch (error) {
      toast.error(error?.message || 'Unable to cancel swap');
    }
  };

  const handleConfirm = async () => {
    try {
      await markComplete(swapId);
      toast.success('Completion confirmed');
    } catch (error) {
      toast.error(error?.message || 'Unable to confirm completion');
    }
  };

  if (isLoading && !swap) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-white/50">Loading swap details...</div>;
  }

  if (!swap) {
    return <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/50">Swap not found.</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        {/* Header and Swap Overview */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
           <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
             <h1 className="text-2xl font-bold text-white">Swap Details</h1>
             <span className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full ${swap.status === 'COMPLETED' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : swap.status === 'CANCELLED' ? 'bg-rose-400/20 text-rose-300 border border-rose-400/30' : 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'}`}>
                {swap.status || 'PENDING'}
             </span>
           </div>
           
           <div className="grid md:grid-cols-2 gap-4">
              <div className={`rounded-2xl bg-slate-950/40 p-4 border flex items-center gap-3 ${isInitiator ? 'border-cyan-400/30 ring-1 ring-cyan-400/10' : 'border-white/5'}`}>
                 <div className="h-10 w-10 bg-cyan-400/20 rounded-full flex items-center justify-center text-cyan-400 text-sm font-bold">
                   {swap.initiator?.profile?.avatarUrl || swap.initiator?.avatarUrl
                     ? <img src={swap.initiator.profile?.avatarUrl || swap.initiator.avatarUrl} alt="" className="rounded-full h-full w-full object-cover"/>
                     : (initiatorName?.charAt(0)?.toUpperCase() || 'I')}
                 </div>
                 <div>
                   <p className="text-xs uppercase text-white/40 tracking-wider">Initiator {isInitiator && <span className="text-cyan-400">(You)</span>}</p>
                   <p className="text-sm font-semibold text-white">{initiatorName || 'Unknown User'}</p>
                 </div>
              </div>
              <div className={`rounded-2xl bg-slate-950/40 p-4 border flex items-center gap-3 ${isReceiver ? 'border-emerald-400/30 ring-1 ring-emerald-400/10' : 'border-white/5'}`}>
                 <div className="h-10 w-10 bg-emerald-400/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold">
                   {swap.receiver?.profile?.avatarUrl || swap.receiver?.avatarUrl
                     ? <img src={swap.receiver.profile?.avatarUrl || swap.receiver.avatarUrl} alt="" className="rounded-full h-full w-full object-cover"/>
                     : (receiverName?.charAt(0)?.toUpperCase() || 'R')}
                 </div>
                 <div>
                   <p className="text-xs uppercase text-white/40 tracking-wider">Receiver {isReceiver && <span className="text-emerald-400">(You)</span>}</p>
                   <p className="text-sm font-semibold text-white">{receiverName || 'Unknown User'}</p>
                 </div>
              </div>
           </div>
        </section>

        {/* Timeline Visualizer */}
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-6">Status Timeline</p>
          <div className="relative flex justify-between items-center max-w-lg mx-auto">
             {/* Line background */}
             <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-1 bg-white/10 -z-10 rounded" />
             {/* Line active */}
             {currentStepIdx >= 0 && (
               <div 
                 className="absolute left-[10%] top-1/2 -translate-y-1/2 h-1 bg-cyan-400 shadow-[0_0_10px_cyan] -z-10 rounded transition-all duration-700" 
                 style={{ width: `${Math.max(0, (currentStepIdx / (swapSteps.length - 1)) * 80)}%` }} 
               />
             )}
             
             {swapSteps.map((step, idx) => {
               const isCompleted = idx < currentStepIdx;
               const isCurrent = idx === currentStepIdx;
               const isCancelled = swap.status === 'CANCELLED';
               
               return (
                 <div key={step} className="flex flex-col items-center gap-2">
                   <div className={`h-8 w-8 rounded-full flex items-center justify-center transition ${isCompleted ? 'bg-cyan-400 text-slate-950' : isCurrent ? 'bg-slate-950 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : isCancelled ? 'bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>
                     {isCompleted ? <BadgeCheck className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                   </div>
                   <span className={`text-[10px] font-bold tracking-widest uppercase ${isCurrent ? 'text-cyan-300' : 'text-white/40'}`}>{step}</span>
                 </div>
               );
             })}
          </div>
        </section>

        {/* Upcoming Session & Next Actions */}
        <div className="grid sm:grid-cols-2 gap-6">
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col">
             <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-4">First Session</p>
             <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border border-white/5 bg-slate-950/30 rounded-2xl">
               {swapSession ? (
                 <>
                   <CalendarClock className="h-8 w-8 text-cyan-300 mb-3" />
                   <p className="text-white font-medium">{formatDateTime(swapSession.scheduledAt)}</p>
                   {swapSession.durationMins != null && (
                     <p className="mt-1 text-xs text-white/50">{swapSession.durationMins} min</p>
                   )}
                   {swap.status === 'ACCEPTED' && (
                     <button
                       type="button"
                       onClick={() => openScheduleModal('reschedule')}
                       className="mt-2 text-xs font-medium text-cyan-300/90 underline decoration-cyan-500/40 hover:text-cyan-200"
                     >
                       Change date & time
                     </button>
                   )}
                   {(swapSession.meetingUrl || swapSession.meetingLink) && (
                     <a href={swapSession.meetingUrl || swapSession.meetingLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 transition rounded-full text-xs font-bold text-white">
                        <Video className="h-3 w-3" /> Join Call
                     </a>
                   )}
                 </>
               ) : (
                 <>
                   <TimerReset className="h-8 w-8 text-white/20 mb-3" />
                   <p className="text-white/40 text-sm">No session scheduled yet.</p>
                 </>
               )}
             </div>
           </section>
           
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col">
             <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45 mb-4">Actions</p>
             <div className="flex flex-col gap-3 justify-center flex-1">
                {swap.status === 'PENDING' && isReceiver && (
                  <>
                    <button onClick={handleAccept} className="w-full rounded-full bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95">Accept Swap</button>
                    <button onClick={handleCancel} className="w-full rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10">Decline</button>
                  </>
                )}
                {swap.status === 'PENDING' && isInitiator && (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl bg-cyan-400/5 border border-cyan-400/15 px-4 py-3">
                      <Clock className="h-5 w-5 text-cyan-300 shrink-0" />
                      <p className="text-sm text-cyan-200/80">Waiting for {receiverName || 'the receiver'} to accept this swap.</p>
                    </div>
                    <button onClick={handleCancel} className="w-full rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10">Cancel Swap</button>
                  </>
                )}
                {swap.status === 'ACCEPTED' && (
                  <>
                    {!swapSession && (
                      <>
                        <button
                          type="button"
                          onClick={() => openScheduleModal('create')}
                          className="w-full rounded-full border border-indigo-400/30 bg-indigo-500/10 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
                        >
                          Schedule Session
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await startSwap(swapId);
                              toast.success('Swap started!');
                            } catch (e) {
                              toast.error(e?.message || 'Failed');
                            }
                          }}
                          className="w-full rounded-full border border-cyan-400/30 bg-cyan-500/10 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          Start Now
                        </button>
                      </>
                    )}
                  </>
                )}
                {swap.status === 'IN_PROGRESS' && (
                  <button onClick={handleConfirm} className="w-full rounded-full border border-emerald-400/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20">Mark Completed</button>
                )}
                {swap.status === 'COMPLETED' && (
                  <button onClick={() => setIsReviewModalOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20">
                    <MessageSquare className="h-4 w-4" /> Leave Review
                  </button>
                )}
                {swap.status === 'CANCELLED' && (
                  <p className="text-center text-sm text-white/40 italic">This swap is inactive.</p>
                )}
             </div>
           </section>
        </div>
      </div>

      <ChatWindow
        title="Active Chat"
        subtitle="Keep the coordination in one place"
        messages={messages}
        onSend={(content, action) => {
          if(action === 'DELETE') return deleteMessage?.(content).catch(() => toast.error('Failed to delete'));
           return sendMessage(content);
        }}
        onTyping={sendTyping}
        isTyping={isTyping}
        active={swap.status !== 'CANCELLED'}
      />

      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">
              {scheduleMode === 'reschedule' ? 'Reschedule session' : 'Schedule session'}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Pick when you will meet. This is shared with your partner.
            </p>
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
                Date & time
                <input
                  type="datetime-local"
                  value={sessionAtLocal}
                  min={toDatetimeLocalValue(new Date())}
                  onChange={(e) => setSessionAtLocal(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                />
              </label>
              {scheduleMode === 'create' && (
                <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
                  Duration (minutes)
                  <input
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    value={sessionDurationMins}
                    onChange={(e) => setSessionDurationMins(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                  />
                </label>
              )}
              <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
                Notes (optional)
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={2}
                  placeholder="Agenda, link to prep material…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isScheduling}
                onClick={handleScheduleSubmit}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-95 disabled:opacity-50"
              >
                {isScheduling ? 'Saving…' : scheduleMode === 'reschedule' ? 'Save new time' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setIsReviewModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition">
               <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-2">Leave a Review</h2>
            <p className="text-sm text-white/50 mb-6">How was your skill swap experience?</p>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                 <button
                   key={star}
                   type="button"
                   aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                   onClick={() => setReviewRating(star)}
                   className="p-1 transition-transform hover:scale-110"
                 >
                   <Star className={`h-10 w-10 ${star <= reviewRating ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'text-slate-700 hover:text-slate-500'}`} />
                 </button>
              ))}
            </div>

            <div className="mb-6 relative">
               <textarea 
                 value={reviewComment}
                 onChange={e => setReviewComment(e.target.value)}
                 placeholder="Write your review here (min 20 characters)..."
                 className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none h-32 outline-none focus:border-cyan-500/50"
               />
               <span className={`absolute bottom-3 right-3 text-xs ${reviewComment.length < 20 || reviewComment.length > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {reviewComment.length}/500
               </span>
            </div>

            <button 
              onClick={handleSubmitReview}
              disabled={isSubmittingReview}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl py-3 text-slate-900 font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapDetail;
