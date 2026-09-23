'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, ShieldCheck, Lock, Mail, ArrowRight } from 'lucide-react';

/**
 * Login page — Dark Futuristic Aesthetic.
 *
 * Uses Supabase email + password authentication. On success, routes to
 * /dashboard which resolves role-based access.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      <div className="relative z-10 w-full max-w-md">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Public Cadastre</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#0A0F16] border border-[rgba(56,189,248,0.30)] shadow-[0_0_20px_rgba(56,189,248,0.10)]">
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
          <p className="mt-1 text-xs font-mono text-[#526174]">
            STATE LAND REGISTRY · PERMISSIONED LEDGER
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[12px] bg-[#0A0F16]/85 border border-[rgba(91,133,167,0.22)] p-8 shadow-[0_0_30px_rgba(56,189,248,0.08)] backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-[rgba(91,133,167,0.16)]">
            <h2 className="text-base font-semibold text-[#F4F7FB]">
              Role Authentication
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#67E8F9]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>ECDSA SECP256K1</span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-[8px] bg-rose-950/30 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-[#94A3B8]"
              >
                Official Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                  placeholder="surveyor@lands.gov.ng"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-[#94A3B8]"
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
                  className="block w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                  placeholder="••••••••••••"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 h-11 flex items-center justify-center gap-2 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration navigation */}
          <div className="mt-5 text-center">
            <p className="text-xs text-[#94A3B8]">
              Don&apos;t have a cadastral credential?{' '}
              <Link
                href="/register"
                className="font-medium text-[#38BDF8] hover:text-[#67E8F9] hover:underline transition-colors"
              >
                Register new account
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[rgba(91,133,167,0.14)] text-center text-[11px] text-[#526174] font-mono">
            <span>Session governed by Nigerian Land Use Act (1978)</span>
          </div>
        </div>
      </div>
    </main>
  );
}
