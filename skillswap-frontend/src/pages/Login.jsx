import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, LockKeyhole, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { validateLogin } from '../utils/validators';

const Login = () => {
  const { login, isLoading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateLogin(form);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    try {
      await login(form);
      toast.success('Welcome back');
    } catch (error) {
      toast.error(error?.message || 'Unable to sign in');
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.24),_transparent_30%),linear-gradient(180deg,_#05111f_0%,_#0b1220_100%)] p-8 text-white lg:flex lg:p-12">
        <div>
          <p className="text-sm font-semibold tracking-[0.3em] text-cyan-300 uppercase">SkillSwap AI</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight text-white">
            Swap skills without the friction.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/65">
            Realtime matching, structured swaps, reminders, and lightweight feedback in one calm workspace.
          </p>
        </div>

        <div className="grid max-w-2xl gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:grid-cols-3">
          {[
            ['Fast matching', 'AI-assisted discovery with clear fit scores.'],
            ['Live chat', 'Keep coordination in the same workflow.'],
            ['Structured follow-up', 'Sessions, reminders, and reviews built in.'],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm text-white/55">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-950 px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">Welcome back</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Sign in to SkillSwap AI</h2>
          <p className="mt-2 text-sm text-white/55">Use your email and password to continue.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
                  placeholder="Your password"
                />
              </div>
              {errors.password ? <p className="mt-2 text-sm text-rose-300">{errors.password}</p> : null}
            </label>

            <div className="flex items-center justify-between text-sm">
              <Link to={ROUTES.forgotPassword} className="font-medium text-cyan-300 transition hover:text-cyan-200">
                Forgot password?
              </Link>
              <Link to={ROUTES.register} className="text-white/55 transition hover:text-white">
                New here? Register
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Login;
