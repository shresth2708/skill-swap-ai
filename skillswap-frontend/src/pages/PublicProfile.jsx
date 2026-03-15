import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { BadgeCheck, Star, User } from 'lucide-react';
import { userAPI, reviewAPI } from '../services/api.service';
import { formatDateTime } from '../utils/formatters';

const PublicProfile = () => {
  const { userId } = useParams();

  const profileQuery = useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: () => userAPI.getPublicProfile(userId),
    enabled: !!userId,
  });

  const reviewsQuery = useQuery({
    queryKey: ['publicReviews', userId],
    queryFn: () => reviewAPI.getReviewsForUser(userId),
    enabled: !!userId,
  });

  const profile = profileQuery.data;
  const publicProfile = profile?.profile || profile || {};
  const reviews = reviewsQuery.data?.data || reviewsQuery.data?.reviews || [];
  const averageRating = reviewsQuery.data?.avgRating || reviewsQuery.data?.averageRating || profile?.avgRating || 0;
  const totalSwaps = profile?.totalSwaps || 0;

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-sm text-cyan-400 font-semibold animate-pulse uppercase tracking-[0.2em]">Loading Profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-sm text-white/50 border border-white/10 bg-white/5 p-6 rounded-3xl">User not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Profile Info */}
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-cyan-900/40 to-emerald-900/40 opacity-50 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8 mt-12">
          {/* Avatar */}
          <div className="h-32 w-32 shrink-0 rounded-full border-4 border-slate-900 bg-slate-800 flex items-center justify-center shadow-xl shadow-cyan-500/20 overflow-hidden relative">
            {publicProfile.avatarUrl ? (
              <img src={publicProfile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-12 w-12 text-cyan-400/50" />
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold text-white mb-2">{publicProfile.displayName || profile?.name || 'Anonymous User'}</h1>
            <p className="text-white/60 mb-6 max-w-2xl">{publicProfile.bio || 'This user has not provided a bio yet.'}</p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
               <div className="flex items-center gap-2 bg-slate-950/40 rounded-full px-4 py-2 border border-white/10">
                 <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
                 <span className="text-sm font-bold text-white">{Number(averageRating).toFixed(1)}</span>
                 <span className="text-xs text-white/40 uppercase tracking-wider">Rating</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-950/40 rounded-full px-4 py-2 border border-white/10">
                 <BadgeCheck className="h-4 w-4 text-emerald-400" />
                 <span className="text-sm font-bold text-white">{totalSwaps}</span>
                 <span className="text-xs text-white/40 uppercase tracking-wider">Swaps</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Offered Skills */}
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 mb-6">Skills Offered</p>
        
        {profile.skills && profile.skills.filter((s) => String(s.type).toLowerCase() === 'offer').length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.filter((s) => String(s.type).toLowerCase() === 'offer').map((skill, idx) => (
              <div key={idx} className="bg-cyan-400/10 border border-cyan-400/20 rounded-xl px-4 py-3 flex flex-col">
                <span className="text-cyan-300 font-semibold">{skill.skill?.name || skill.name}</span>
                <span className="text-xs text-white/40 mt-1 capitalize">{skill.proficiencyLevel || skill.proficiency || 'Intermediate'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30 italic">No skills offered yet.</p>
        )}
      </section>

      {/* Reviews Section */}
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 mb-6">Recent Reviews</p>

        {reviewsQuery.isLoading ? (
          <div className="text-sm text-white/50">Loading reviews...</div>
        ) : reviews.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-slate-950/40 rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden">
                       {review.reviewer?.profile?.avatarUrl ? (
                         <img src={review.reviewer.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                       ) : (
                         <span className="text-xs text-white/50">{review.reviewer?.profile?.displayName?.charAt(0) || review.reviewer?.email?.charAt(0) || 'U'}</span>
                       )}
                     </div>
                     <div>
                       <p className="text-sm font-semibold text-white/90">{review.reviewer?.profile?.displayName || review.reviewer?.email || 'Unknown'}</p>
                       <p className="text-[10px] text-white/40 uppercase tracking-wider">{formatDateTime(review.createdAt)}</p>
                     </div>
                   </div>
                   <div className="flex gap-1">
                     {Array.from({length: 5}).map((_, i) => (
                       <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
                     ))}
                   </div>
                </div>
                <p className="text-sm text-white/70 italic leading-relaxed">"{review.comment}"</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30 italic border border-dashed border-white/10 rounded-2xl p-6 text-center">No reviews yet for this user.</p>
        )}
      </section>
    </div>
  );
};

export default PublicProfile;
