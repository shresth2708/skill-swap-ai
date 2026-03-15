import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Mail } from 'lucide-react';
import { authAPI } from '../services/api.service';
import { ROUTES } from '../constants/routes';
import { validateEmail } from '../utils/validators';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextError = validateEmail(email);
    setError(nextError);

    if (nextError) {
      return;
    }

    try {
      setIsSubmitting(true);
      await authAPI.forgotPassword({ email });
      toast.success('If that email exists, a reset link has been sent.');
    } catch (requestError) {
      toast.error(requestError?.message || 'Unable to start password recovery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.15),_transparent_26%),linear-gradient(180deg,_#05111f_0%,_#0b1220_100%)] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">Recovery</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-white/55">We’ll send a reset link if the account exists.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">Email</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
              <Mail className="h-4 w-4 text-cyan-300" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="name@skillswap.ai"
              />
            </div>
            {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Remembered it?{' '}
          <Link to={ROUTES.login} className="font-medium text-cyan-300 transition hover:text-cyan-200">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
