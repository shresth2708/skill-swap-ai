import { useState, useMemo, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Save, Star, Search, Trash2, Calendar, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { userAPI, reviewAPI } from '../services/api.service';
import { formatDateTime } from '../utils/formatters';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOTS = ['Morning', 'Afternoon', 'Evening'];

const Profile = () => {
  const { user, setUser } = useAuthContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile Query
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => userAPI.getProfile(),
    initialData: user,
  });

  const current = useMemo(() => profileQuery.data || user || {}, [profileQuery.data, user]);

  // Reviews Query
  const reviewsQuery = useQuery({
    queryKey: ['myReviews', current.id],
    queryFn: () => reviewAPI.getReviewsForUser(current.id),
    enabled: !!current.id && activeTab === 'reviews',
  });

  const reviews = reviewsQuery.data?.data || reviewsQuery.data?.reviews || [];
  const averageRating = reviewsQuery.data?.avgRating || reviewsQuery.data?.averageRating || current.avgRating || 0;

  // Local State
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [skillSearch, setSkillSearch] = useState('');
  const offeredSkillProficiency = 'Intermediate';
  const wantedSkillProficiency = 'Intermediate';
  const initialAvailability = useMemo(() => {
    if (!current.availabilitySlots) return {};
    const dayReverseMap = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const res = {};
    for (const slot of current.availabilitySlots) {
      const dayName = dayReverseMap[slot.dayOfWeek];
      if (!dayName) continue;
      const startHour = new Date(slot.slotStart).getUTCHours();
      let slotName = '';
      if (startHour === 8) slotName = 'Morning';
      else if (startHour === 12) slotName = 'Afternoon';
      else if (startHour === 17) slotName = 'Evening';
      if (slotName) {
        if (!res[dayName]) res[dayName] = [];
        res[dayName].push(slotName);
      }
    }
    return res;
  }, [current.availabilitySlots]);

  const [availability, setAvailability] = useState(initialAvailability);

  useEffect(() => {
    setAvailability(initialAvailability);
  }, [initialAvailability]);
  
  const [notifications, setNotifications] = useState({
     notifyEmail: current.profile?.notifyEmail ?? false,
     notifyPush: current.profile?.notifyPush ?? false,
     notifyInApp: current.profile?.notifyInApp ?? true,
  });



  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      displayName: String(formData.get('displayName') || '').trim(),
      bio: String(formData.get('bio') || '').trim(),
      location: String(formData.get('location') || '').trim(),
      timezone: String(formData.get('timezone') || '').trim(),
    };
    if (avatarPreview) nextProfile.avatarUrl = avatarPreview;

    try {
      const updated = await userAPI.updateProfile(nextProfile);
      setUser(updated);
      queryClient.setQueryData(['profile'], updated);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error?.message || 'Unable to update profile');
    }
  };

  const handleAddSkill = async (type) => {
    if (!skillSearch.trim()) return;
    try {
      await userAPI.addSkill({ 
        name: skillSearch, 
        type: type, 
        proficiency: type === 'offer' ? offeredSkillProficiency : wantedSkillProficiency 
      });
      toast.success('Skill added');
      queryClient.invalidateQueries(['profile']);
      setSkillSearch('');
    } catch {
      toast.error('Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillId) => {
    if(!window.confirm('Remove this skill?')) return;
    try {
      console.log('Attempting to remove skill with ID:', skillId);
      await userAPI.removeSkill(skillId);
      toast.success('Skill removed');
      queryClient.invalidateQueries(['profile']);
    } catch (err) {
      console.error('Failed to remove skill:', err);
      toast.error('Failed to remove skill: ' + (err?.message || 'Unknown error'));
    }
  };

  const toggleAvailability = (day, slot) => {
    setAvailability(prev => {
      const next = { ...prev };
      if (!next[day]) next[day] = [];
      if (next[day].includes(slot)) {
         next[day] = next[day].filter(s => s !== slot);
      } else {
         next[day] = [...next[day], slot];
      }
      return next;
    });
  };

  const handleSaveAvailability = async () => {
    try {
      await userAPI.updateAvailability({ availability });
      toast.success('Availability saved');
      queryClient.invalidateQueries(['profile']);
    } catch {
      toast.error('Failed to save availability');
    }
  };

  const handleNotificationToggle = async (key) => {
     const nextNotifs = { ...notifications, [key]: !notifications[key] };
     setNotifications(nextNotifs);
     try {
       await userAPI.updateNotificationPreferences(nextNotifs);
       toast.success('Preferences updated');
     } catch {
       toast.error('Failed to update preferences');
       setNotifications(notifications); // revert
     }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       {/* Tabs Navigation */}
       <div className="flex gap-4 border-b border-white/10 mb-6">
          <button 
             onClick={() => setActiveTab('profile')} 
             className={`pb-4 px-4 text-sm font-semibold transition-colors relative ${activeTab === 'profile' ? 'text-cyan-400' : 'text-white/50 hover:text-white'}`}
          >
             My Profile
             {activeTab === 'profile' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_cyan]" />}
          </button>
          <button 
             onClick={() => setActiveTab('reviews')} 
             className={`pb-4 px-4 text-sm font-semibold transition-colors relative ${activeTab === 'reviews' ? 'text-cyan-400' : 'text-white/50 hover:text-white'}`}
          >
             Reviews Received
             {activeTab === 'reviews' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_cyan]" />}
          </button>
       </div>

       {activeTab === 'profile' && (
         <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
           <div className="space-y-6">
             {/* General Info Form */}
             <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
               <div className="flex items-center gap-6">
                 <div onClick={() => fileInputRef.current?.click()} className="relative group cursor-pointer flex h-24 w-24 overflow-hidden items-center justify-center rounded-3xl bg-slate-900 border border-white/10 shadow-lg shrink-0">
                   {avatarPreview || current.profile?.avatarUrl || current.avatarUrl ? (
                     <img src={avatarPreview || current.profile?.avatarUrl || current.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                   ) : (
                     <Camera className="h-8 w-8 text-cyan-400/50" />
                   )}
                   <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Camera className="h-6 w-6 text-white" />
                   </div>
                   <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleAvatarChange} />
                 </div>
                 <div className="flex-1 text-sm text-white/50 space-y-1">
                   <p className="font-medium text-white/80">Profile Photo</p>
                   <p>Click to upload a new avatar. Preview shown instantly.</p>
                 </div>
               </div>

               <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                 <label className="block">
                   <span className="mb-2 block text-sm font-medium text-white/80">Display Name</span>
                   <input name="displayName" defaultValue={current.profile?.displayName || current.displayName || current.name || ''} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" />
                 </label>
                 
                 <label className="block">
                   <span className="mb-2 block text-sm font-medium text-white/80">Bio</span>
                   <textarea name="bio" rows={3} defaultValue={current.profile?.bio || current.bio || ''} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 resize-none" />
                 </label>

                 <div className="grid grid-cols-2 gap-4">
                   <label className="block">
                     <span className="mb-2 block text-sm font-medium text-white/80">Location</span>
                     <input name="location" defaultValue={current.profile?.location || current.location || ''} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50" />
                   </label>
                   <label className="block">
                     <span className="mb-2 block text-sm font-medium text-white/80">Timezone</span>
                     <select name="timezone" defaultValue={current.profile?.timezone || current.timezone || 'UTC'} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50 appearance-none">
                        <option value="UTC">UTC</option>
                        <option value="EST">EST</option>
                        <option value="PST">PST</option>
                        <option value="CET">CET</option>
                        <option value="IST">IST</option>
                     </select>
                   </label>
                 </div>

                 <button type="submit" className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
                   <Save className="h-4 w-4" /> Save General Info
                 </button>
               </form>
             </section>

             {/* Notifications */}
             <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 mb-6 flex items-center gap-2">
                   <Bell className="h-4 w-4" /> Notification Preferences
                </p>
                <div className="space-y-4">
                   {[
                     { key: 'notifyEmail', label: 'Email Notifications', desc: 'Receive daily digests and important updates' },
                     { key: 'notifyPush', label: 'Push Notifications', desc: 'Get notified in the background on your device' },
                     { key: 'notifyInApp', label: 'In-App Notifications', desc: 'Alerts while you are actively using the app' },
                   ].map(notif => (
                     <div key={notif.key} className="flex items-center justify-between bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                        <div>
                           <p className="text-sm font-semibold text-white/90">{notif.label}</p>
                           <p className="text-xs text-white/40 mt-1">{notif.desc}</p>
                        </div>
                        <button 
                           onClick={() => handleNotificationToggle(notif.key)} 
                           className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${notifications[notif.key] ? 'bg-cyan-500' : 'bg-slate-700'}`}
                        >
                           <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifications[notif.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                     </div>
                   ))}
                </div>
             </section>
           </div>

           <div className="space-y-6">
             {/* Skills Section */}
             <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
               <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 mb-6">Manage Skills</p>
               
               <div className="mb-6 flex gap-2">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                   <input 
                     value={skillSearch} 
                     onChange={(e) => setSkillSearch(e.target.value)} 
                     placeholder="Search to add skill (e.g. React)..." 
                     className="w-full rounded-xl border border-white/10 bg-slate-950/60 pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-cyan-400/50" 
                   />
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => handleAddSkill('offer')} className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition">Offer</button>
                    <button onClick={() => handleAddSkill('want')} className="px-3 py-2 bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-500/30 hover:bg-indigo-500/30 transition">Want</button>
                 </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <p className="text-xs font-semibold text-white/50 mb-3 border-b border-white/5 pb-2">Skills I Offer</p>
                   <div className="flex flex-wrap gap-2">
                     {current.skills?.filter((s) => String(s.type).toLowerCase() === 'offer').map((s) => (
                       <div key={s.id || s.name} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                         <span className="text-sm text-emerald-100">{s.skill?.name || s.name}</span>
                         <button onClick={() => handleRemoveSkill(s.id)} className="text-emerald-500 hover:text-emerald-300"><Trash2 className="h-3 w-3" /></button>
                       </div>
                     )) || <p className="text-xs text-white/30">None added.</p>}
                   </div>
                 </div>

                 <div>
                   <p className="text-xs font-semibold text-white/50 mb-3 border-b border-white/5 pb-2">Skills I Want</p>
                   <div className="flex flex-wrap gap-2">
                     {current.skills?.filter((s) => String(s.type).toLowerCase() === 'want').map((s) => (
                       <div key={s.id || s.name} className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">
                         <span className="text-sm text-indigo-100">{s.skill?.name || s.name}</span>
                         <button onClick={() => handleRemoveSkill(s.id)} className="text-indigo-500 hover:text-indigo-300"><Trash2 className="h-3 w-3" /></button>
                       </div>
                     )) || <p className="text-xs text-white/30">None added.</p>}
                   </div>
                 </div>
               </div>
             </section>

             {/* Availability Grid */}
             <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
               <div className="flex items-center justify-between mb-6">
                 <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 flex items-center gap-2"><Calendar className="h-4 w-4" /> Weekly Availability</p>
                 <button onClick={handleSaveAvailability} className="px-4 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-full text-xs font-bold border border-cyan-500/30 hover:bg-cyan-500/30 transition">Save Slots</button>
               </div>

               <div className="space-y-4">
                 {DAYS.map(day => (
                   <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                      <span className="text-sm font-medium text-white/80 w-24">{day}</span>
                      <div className="flex gap-2 flex-1 justify-end">
                        {SLOTS.map(slot => {
                           const active = availability[day]?.includes(slot);
                           return (
                             <button
                               key={slot}
                               onClick={() => toggleAvailability(day, slot)}
                               className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${active ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-slate-800 text-white/40 hover:bg-slate-700'}`}
                             >
                               {slot}
                             </button>
                           );
                        })}
                      </div>
                   </div>
                 ))}
               </div>
             </section>
           </div>
         </div>
       )}

       {activeTab === 'reviews' && (
         <div className="max-w-4xl mx-auto space-y-6">
           {/* Summary Stats */}
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/10 backdrop-blur-xl flex flex-col items-center justify-center">
             <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-amber-500 mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
               {Number(averageRating).toFixed(1)}
             </div>
             <div className="flex gap-2 mb-3">
               {[1,2,3,4,5].map(star => (
                 <Star key={star} className={`h-6 w-6 ${star <= Math.round(averageRating) ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-white/10'}`} />
               ))}
             </div>
             <p className="text-sm text-white/40 uppercase tracking-widest font-bold">Based on {reviews.length} reviews</p>
           </section>

           {/* Review List */}
           <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-xl min-h-[300px]">
             <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45 mb-6">Recent Feedback</p>
             
             {reviewsQuery.isLoading ? (
               <div className="flex items-center justify-center p-10"><p className="text-cyan-400 animate-pulse text-sm font-bold uppercase tracking-wider">Loading Reviews...</p></div>
             ) : reviews.length > 0 ? (
               <div className="grid gap-4">
                 {reviews.map(review => (
                   <div key={review.id} className="bg-slate-950/40 rounded-2xl p-6 border border-white/5">
                     <div className="flex justify-between items-start mb-4">
                       <div className="flex gap-3 items-center">
                         <div className="h-10 w-10 bg-cyan-900 rounded-full flex items-center justify-center text-cyan-200 overflow-hidden">
                            {review.reviewer?.profile?.avatarUrl ? <img src={review.reviewer.profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : 'U'}
                         </div>
                         <div>
                           <p className="text-sm font-semibold text-white/80">{review.reviewer?.profile?.displayName || review.reviewer?.email || 'Anonymous User'}</p>
                           <p className="text-xs text-white/40 mt-0.5">{formatDateTime(review.createdAt)}</p>
                         </div>
                       </div>
                       <div className="flex gap-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`h-4 w-4 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-800'}`} />
                          ))}
                       </div>
                     </div>
                     <p className="text-sm text-white/70 italic leading-relaxed">"{review.comment}"</p>
                   </div>
                 ))}
                 
                 {/* Basic Pagination (Mock style for aesthetic) */}
                 {reviews.length > 10 && (
                   <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/5">
                     <button className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition"><ChevronLeft className="h-4 w-4" /></button>
                     <span className="text-xs text-white/40 uppercase tracking-widest font-semibold flex gap-2"><span>Page</span> <span className="text-cyan-400">1</span> <span>of</span> <span>3</span></span>
                     <button className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white transition"><ChevronRight className="h-4 w-4" /></button>
                   </div>
                 )}
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Star className="h-12 w-12 text-white/10 mb-4" />
                  <p className="text-lg font-medium text-white/70">No reviews yet</p>
                  <p className="text-sm text-white/40 mt-1">Complete more swaps to start receiving reviews!</p>
               </div>
             )}
           </section>
         </div>
       )}
    </div>
  );
};

export default Profile;
