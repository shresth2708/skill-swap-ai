import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { authAPI } from '../services/api.service';
import { ROUTES } from '../constants/routes';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationError = useMemo(() => {
    if (!token) return 'Missing reset token. Please use the password-reset link from your email.';
    if (password.length > 0 && password.length < 8) return 'Password must be at least 8 characters.';
    if (confirmPassword && password !== confirmPassword) return 'Passwords do not match.';
    return '';
  }, [token, password, confirmPassword]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (validationError || !password || !confirmPassword) {
      toast.error(validationError || 'Please complete all fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authAPI.resetPassword({ token, newPassword: password });
      toast.success('Password reset successful. Please sign in.');
      navigate(ROUTES.login, { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Unable to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.15),_transparent_26%),linear-gradient(180deg,_#05111f_0%,_#0b1220_100%)] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <p className="text-sm font-semibold tracking-[0.28em] text-cyan-300 uppercase">Security</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Set a new password</h1>
        <p className="mt-2 text-sm text-white/55">Choose a strong password for your SkillSwap account.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">New password</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
              <LockKeyhole className="h-4 w-4 text-cyan-300" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Minimum 8 characters"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">Confirm password</span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 focus-within:border-cyan-400/40">
              <LockKeyhole className="h-4 w-4 text-cyan-300" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Re-enter your password"
              />
            </div>
          </label>

          {validationError ? <p className="text-sm text-rose-300">{validationError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || Boolean(validationError)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Updating...' : 'Reset password'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/55">
          Back to{' '}
          <Link to={ROUTES.login} className="font-medium text-cyan-300 transition hover:text-cyan-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
