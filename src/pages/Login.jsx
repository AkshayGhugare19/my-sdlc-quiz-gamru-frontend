import { useForm } from 'react-hook-form';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore.js';
import Icon from '../components/Icon.jsx';
import { Spinner } from '../components/ui.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import gamruLogo from '../assets/gamru.svg';

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const { register, handleSubmit } = useForm({
    defaultValues: { email: 'admin@acme.com', password: 'Password123!' },
  });

  if (token) return <Navigate to="/" replace />;

  const onSubmit = async ({ email, password }) => {
    if (await login(email, password)) navigate('/');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-neon/10 blur-3xl animate-floaty" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-royal/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src={gamruLogo} alt="Gamru" className="h-12 w-auto" />
          <div className="border-l border-white/15 pl-3 text-[11px] uppercase tracking-[0.25em] text-neon/80 leading-tight">
            Admin
            <br />
            Console
          </div>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            The control room for your <span className="text-neon">gamified learning</span> engine.
          </h2>
          <p className="text-white/50 mt-4 max-w-md">
            Author missions, tune reward rules, run tournaments, and watch completion analytics — all from one
             dashboard.
          </p>
          <div className="flex gap-3 mt-8">
            {['Missions', 'Rewards', 'Analytics'].map((t) => (
              <span key={t} className="chip glass border border-white/10 text-white/70 px-3 py-1.5">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative text-white/30 text-xs">© {new Date().getFullYear()} Gamru · Gamification Engine</div>
      </div>

      {/* Form panel */}
      <div className="grid place-items-center p-6">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit(onSubmit)}
          className="glass-strong rounded-3xl p-8 w-full max-w-md shadow-neon"
        >
          <div className="lg:hidden flex items-center mb-6">
            <img src={gamruLogo} alt="Gamru" className="h-9 w-auto" />
          </div>
          <div className="text-neon text-xs font-bold tracking-[0.2em]">WELCOME BACK</div>
          <h1 className="text-2xl font-extrabold mt-1 mb-6 text-white">Sign in to the console</h1>

          <label className="label">Email</label>
          <input {...register('email')} className="field mb-4" autoComplete="username" />

          <label className="label">Password</label>
          <PasswordInput {...register('password')} className="field" wrapperClassName="mb-5" autoComplete="current-password" />

          {error && (
            <div className="text-red-300 text-sm mb-4 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2">
              {error}
            </div>
          )}

          <button disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Spinner className="w-5 h-5" /> : <Icon name="logout" className="w-4 h-4 rotate-180" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-6 rounded-xl bg-black/20 border border-white/10 p-3 text-xs text-white/45 space-y-1">
            <div className="text-white/60 font-semibold">Demo credentials</div>
            <div>Org admin — admin@acme.com · Password123!</div>
            <div>Super admin — superadmin@platform.com · Password123!</div>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
