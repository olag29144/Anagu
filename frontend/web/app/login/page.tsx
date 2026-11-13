'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createClient,
  DEMO_ACCOUNTS,
  setDemoSession,
  type DemoAccount,
} from '@/lib/supabase';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  User,
  FileCheck,
  Building,
  Landmark,
  Compass,
  Sparkles,
} from 'lucide-react';

/**
 * Login page — Dark Futuristic Aesthetic with instant Demo Account Access.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  // Instant 1-Click Demo Login handler
  const handleInstantDemoLogin = (account: DemoAccount) => {
    setError(null);
    setDemoLoading(account.role);

    setDemoSession(account);

    setTimeout(() => {
      router.push(account.defaultPath);
      router.refresh();
    }, 200);
  };

  // Auto-fill form fields with demo credentials
  const handleFillDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword('demo1234');
    setError(null);
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#020305] text-[#F4F7FB] px-4 py-12 overflow-hidden font-sans">
      {/* Background honeycomb image and subtle glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#020305] bg-[url('/assets/honeycomb-background.jpg')] bg-cover bg-center bg-no-repeat opacity-35"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-1/4 top-1/4 w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,transparent_70%)] blur-3xl -z-10"
      />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/?public=1"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Public Cadastre</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Demo Accounts Available</span>
          </div>
        </div>

        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#0A0F16] border border-[rgba(56,189,248,0.30)] shadow-[0_0_20px_rgba(56,189,248,0.10)]">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-[#38BDF8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
              <polyline points="12 6 12 12 18 15" />
              <circle cx="12" cy="12" r="1.5" fill="#67E8F9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F7FB]">
            ANAGU CONSOLE
          </h1>
          <p className="mt-1 text-xs font-mono text-[#64748B]">
            NIGERIAN STATE LAND REGISTRY · PERMISSIONED CADASTRE LEDGER
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Quick 1-Click Demo Accounts */}
          <div className="lg:col-span-7 rounded-[12px] bg-[#0A0F16]/85 border border-[#1E293B] p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#38BDF8]" />
                <h2 className="text-sm font-semibold text-[#F4F7FB]">
                  1-Click Demo Personas
                </h2>
              </div>
              <span className="text-[10px] font-mono uppercase text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded border border-[#38BDF8]/20">
                INSTANT ENTRY
              </span>
            </div>

            <p className="text-xs text-[#94A3B8] mb-4">
              Select any Cadastre persona below to immediately access their official dashboard and workflows without manual credential entry:
            </p>

            <div className="space-y-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = demoLoading === acc.role;
                const Icon =
                  acc.role === 'citizen'
                    ? User
                    : acc.role === 'registrar'
                    ? FileCheck
                    : acc.role === 'land_admin'
                    ? Building
                    : acc.role === 'governor'
                    ? Landmark
                    : Compass;

                const badgeColor =
                  acc.role === 'citizen'
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : acc.role === 'registrar'
                    ? 'border-sky-500/40 text-sky-400 bg-sky-500/10'
                    : acc.role === 'land_admin'
                    ? 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                    : acc.role === 'governor'
                    ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                    : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10';

                return (
                  <div
                    key={acc.role}
                    className="p-3.5 rounded-xl bg-[#020305]/80 border border-[#1E293B] hover:border-[#38BDF8]/50 transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-[#0A0F16] border border-[#1E293B] text-[#38BDF8] group-hover:text-[#67E8F9] transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#F4F7FB]">
                            {acc.name}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${badgeColor}`}
                          >
                            {acc.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] font-mono">
                          {acc.email} · <span className="text-[#38BDF8]/80">{acc.title}</span>
                        </p>
                        <p className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1">
                          {acc.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFillDemo(acc)}
                        className="px-2.5 py-1 text-[11px] font-mono text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#1E293B] rounded border border-transparent hover:border-[#1E293B] transition-all"
                        title="Fill into form"
                      >
                        Auto-fill
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInstantDemoLogin(acc)}
                        disabled={isSelected}
                        className="px-3 py-1.5 text-xs font-semibold text-[#020305] bg-[#38BDF8] hover:bg-[#67E8F9] rounded-lg shadow-sm hover:shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSelected ? (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
                        ) : (
                          <>
                            <span>Enter Portal</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Manual Credentials Form */}
          <div className="lg:col-span-5 rounded-[12px] bg-[#0A0F16]/85 border border-[#1E293B] p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#1E293B]">
                <h2 className="text-sm font-semibold text-[#F4F7FB]">
                  Role Credentials
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#67E8F9]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>SECP256K1</span>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-[8px] bg-rose-950/30 border border-rose-500/40 px-3 py-2 text-xs text-rose-300"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-xs font-mono uppercase tracking-wider text-[#94A3B8]"
                  >
                    Cadastral Email / Role
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full h-10 pl-9 pr-3 rounded-[8px] bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]"
                      placeholder="citizen@anagu.gov.ng"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#526174]" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-xs font-mono uppercase tracking-wider text-[#94A3B8]"
                  >
                    Security Credential
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full h-10 pl-9 pr-3 rounded-[8px] bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-1 focus:ring-[#38BDF8]"
                      placeholder="••••••••••••"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#526174]" />
                  </div>
                  <p className="mt-1 text-[10px] text-[#64748B] font-mono">
                    Any password works for demo accounts (e.g. demo1234)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 h-10 flex items-center justify-center gap-2 rounded-[8px] bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
                  ) : (
                    <>
                      <span>Sign In & Verify Role</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1E293B]">
              <div className="text-center text-xs text-[#94A3B8]">
                <span>Need a new statutory credential? </span>
                <Link
                  href="/register"
                  className="font-medium text-[#38BDF8] hover:underline"
                >
                  Register
                </Link>
              </div>
              <div className="mt-2 text-center text-[10px] text-[#526174] font-mono">
                Land Use Act (1978) · Federal Republic of Nigeria
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
