import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, Mail, LockKeyhole, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { getPasswordStrength, validateRegister } from '../utils/validators';
import { userAPI } from '../services/api.service';

const strengthTone = {
  'Very weak': 'bg-rose-400',
  Weak: 'bg-orange-400',
  Fair: 'bg-amber-400',
  Good: 'bg-cyan-400',
  Strong: 'bg-emerald-400',
};

const SkillsModal = ({ onComplete }) => {
  const [search, setSearch] = useState('');
  const [offered, setOffered] = useState([]);
  const [wanted, setWanted] = useState([]);

  const handleAdd = async (type) => {
    if (!search.trim()) return;
    try {
      await userAPI.addSkill({ name: search, type, proficiency: 'Intermediate' });
      if (type === 'offer') setOffered([...offered, search]);
      else setWanted([...wanted, search]);
      setSearch('');
      toast.success('Skill added');
    } catch {
      toast.error('Failed to add skill');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl relative">
        <h3 className="text-xl font-semibold text-white mb-2">What skills do you offer and want?</h3>
        <p className="text-sm text-white/50 mb-6">Let's set up your profile so you can find matches immediately.</p>
        
        <div className="mb-6 flex gap-2">
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search to add skill (e.g. React)..." 
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-cyan-400/50" 
          />
          <button onClick={() => handleAdd('offer')} className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition">Offer</button>
          <button onClick={() => handleAdd('want')} className="px-3 py-2 bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-500/30 hover:bg-indigo-500/30 transition">Want</button>
        </div>

        <div className="space-y-4 mb-8">
          <div className="min-h-12 border border-white/5 bg-slate-950/40 p-3 rounded-2xl">
            <p className="text-xs font-semibold text-emerald-400/80 mb-2 uppercase tracking-wider">Skills I Offer</p>
            <div className="flex flex-wrap gap-2">
              {offered.map((s, i) => (
                <span key={i} className="bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-full px-3 py-1 text-xs">{s}</span>
              ))}
              {offered.length === 0 && <span className="text-xs text-white/30 italic">None added yet.</span>}
            </div>
          </div>
          <div className="min-h-12 border border-white/5 bg-slate-950/40 p-3 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-400/80 mb-2 uppercase tracking-wider">Skills I Want</p>
            <div className="flex flex-wrap gap-2">
              {wanted.map((s, i) => (
                <span key={i} className="bg-indigo-500/10 text-indigo-100 border border-indigo-500/20 rounded-full px-3 py-1 text-xs">{s}</span>
              ))}
              {wanted.length === 0 && <span className="text-xs text-white/30 italic">None added yet.</span>}
            </div>
          </div>
        </div>

        <button onClick={onComplete} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-slate-950 font-bold transition hover:opacity-90 shadow-lg shadow-cyan-400/20">
          Take me to Dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Register = () => {
  const { register, isLoading } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateRegister(form);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    try {
      await register({
        displayName: form.name,
        email: form.email,
        password: form.password,
      }, false);
      toast.success('Account created! Now add some skills.');
      setShowSkillsModal(true);
    } catch (error) {
      toast.error(error?.message || 'Unable to create account');
    }
  };

  const handleModalComplete = () => {
    navigate(ROUTES.dashboard, { replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <section className="order-2 flex items-center justify-center bg-slate-950 px-4 py-10 sm:px-6 lg:order-1 lg:px-10">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">Create account</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Join SkillSwap AI</h2>
          <p className="mt-2 text-sm text-white/55">Set up your profile and start matching skills.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Name</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
                <UserPlus className="h-4 w-4 text-cyan-300" />
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Your display name"
                />
              </div>
              {errors.name ? <p className="mt-2 text-sm text-rose-300">{errors.name}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
                <Mail className="h-4 w-4 text-cyan-300" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="name@skillswap.ai"
                />
              </div>
              {errors.email ? <p className="mt-2 text-sm text-rose-300">{errors.email}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Choose a strong password"
                />
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Password strength</span>
                  <span>{strength.label}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className={`h-2 rounded-full transition-all ${strengthTone[strength.label] || 'bg-white/40'}`}
                    style={{ width: `${Math.max(20, strength.score * 20)}%` }}
                  />
                </div>
              </div>
              {errors.password ? <p className="mt-2 text-sm text-rose-300">{errors.password}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/80">Confirm password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Confirm your password"
                />
              </div>
              {errors.confirmPassword ? <p className="mt-2 text-sm text-rose-300">{errors.confirmPassword}</p> : null}
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/55">
            Already have an account?{' '}
            <Link to={ROUTES.login} className="font-medium text-cyan-300 transition hover:text-cyan-200">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <section className="order-1 hidden flex-col justify-between bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_28%),linear-gradient(180deg,_#05111f_0%,_#0b1220_100%)] p-8 text-white lg:order-2 lg:flex lg:p-12">
        <div>
          <p className="text-sm font-semibold tracking-[0.3em] text-emerald-300 uppercase">Start here</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight text-white">
            Build a profile that makes the right exchange obvious.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/65">
            Capture your offering, what you want to learn, and your availability so matches can happen faster.
          </p>
        </div>

        <div className="grid max-w-2xl gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:grid-cols-2">
          {[
            ['Profile-first onboarding', 'Set display name, skills, and schedule preferences.'],
            ['Confidence signals', 'Strong passwords and clear validation guide the flow.'],
            ['Fast activation', 'Get redirected to your dashboard as soon as you sign up.'],
            ['Ready for expansion', 'The same layout supports chat, notifications, and swaps.'],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm text-white/55">{description}</p>
            </div>
          ))}
        </div>
      </section>
      
      {showSkillsModal && <SkillsModal onComplete={handleModalComplete} />}
    </div>
  );
};

export default Register;
