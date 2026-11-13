'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  DEMO_ACCOUNTS,
  getActiveDemoAccount,
  setDemoSession,
  clearDemoSession,
  type DemoAccount,
} from '@/lib/supabase';
import {
  ShieldCheck,
  LogOut,
  Layers,
  User,
  Compass,
  FileCheck,
  Building,
  Landmark,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface PortalHeaderProps {
  currentRoleTitle?: string;
}

export function PortalHeader({ currentRoleTitle }: PortalHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeAccount, setActiveAccount] = useState<DemoAccount | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setActiveAccount(getActiveDemoAccount());
  }, [pathname]);

  const handleSwitchAccount = (account: DemoAccount) => {
    setDemoSession(account);
    setActiveAccount(account);
    setMenuOpen(false);
    router.push(account.defaultPath);
    router.refresh();
  };

  const handleSignOut = () => {
    clearDemoSession();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'citizen':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'registrar':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'land_admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'governor':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'surveyor':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <header className="border-b border-[#1E293B] bg-[#0A0F16]/95 backdrop-blur-md sticky top-0 z-40 text-[#F4F7FB]">
      {/* Top Banner / System strip */}
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <Link
            href="/?public=1"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Return to Public Cadastre Landing"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#020305] border border-[#38BDF8]/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5 text-[#38BDF8]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
                <polyline points="12 6 12 12 18 15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider text-[#F4F7FB]">
                  ANAGU CADASTRE
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#020305] text-[#38BDF8] border border-[#38BDF8]/20">
                  DEMO PORTAL
                </span>
              </div>
            </div>
          </Link>

          {/* Current role tag */}
          {activeAccount && (
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border ${getRoleBadgeColor(
                activeAccount.role,
              )}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              <span>{activeAccount.role.toUpperCase()} MODE</span>
            </div>
          )}
        </div>

        {/* Right: Switch Role & Account info */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Quick role switches */}
          <div className="hidden lg:flex items-center gap-1 bg-[#020305] p-1 rounded-lg border border-[#1E293B]">
            {DEMO_ACCOUNTS.map((acc) => {
              const isCurrent = activeAccount?.role === acc.role;
              return (
                <button
                  key={acc.role}
                  onClick={() => handleSwitchAccount(acc)}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-all ${
                    isCurrent
                      ? 'bg-[#38BDF8] text-[#020305] font-semibold shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#1E293B]/60'
                  }`}
                  title={`${acc.title} (${acc.email})`}
                >
                  {acc.role === 'land_admin' ? 'Admin' : acc.role.charAt(0).toUpperCase() + acc.role.slice(1)}
                </button>
              );
            })}
          </div>

          {/* User profile dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-[#020305] border border-[#1E293B] hover:border-[#38BDF8]/40 px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <div className="h-5 w-5 rounded-full bg-[#1E293B] text-[#38BDF8] flex items-center justify-center font-bold text-[10px]">
                {activeAccount?.name.charAt(0) ?? 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="font-medium text-[#F4F7FB] truncate max-w-[140px]">
                  {activeAccount?.name ?? 'Demo Officer'}
                </p>
                <p className="text-[10px] font-mono text-[#64748B] truncate max-w-[140px]">
                  {activeAccount?.email ?? 'demo@anagu.gov.ng'}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0A0F16] border border-[#1E293B] p-2 shadow-2xl z-50">
                <div className="px-3 py-2 border-b border-[#1E293B]">
                  <p className="text-xs font-semibold text-[#F4F7FB]">{activeAccount?.name}</p>
                  <p className="text-[11px] text-[#64748B] font-mono">{activeAccount?.email}</p>
                  <p className="text-[11px] text-[#38BDF8] mt-1">{activeAccount?.department}</p>
                </div>

                <div className="py-2">
                  <p className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#64748B] mb-1">
                    Switch Demo Persona
                  </p>
                  {DEMO_ACCOUNTS.map((acc) => {
                    const isSelected = activeAccount?.role === acc.role;
                    return (
                      <button
                        key={acc.role}
                        onClick={() => handleSwitchAccount(acc)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#38BDF8]/15 text-[#38BDF8] font-medium'
                            : 'text-[#94A3B8] hover:bg-[#1E293B]/60 hover:text-[#F4F7FB]'
                        }`}
                      >
                        <div>
                          <span>{acc.name}</span>
                          <span className="block text-[10px] text-[#64748B] font-mono">
                            {acc.title}
                          </span>
                        </div>
                        {isSelected && <span className="text-[10px] font-mono">ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#1E293B] space-y-1">
                  <Link
                    href="/?public=1"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#1E293B]/60 rounded-lg transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Cadastre Public Landing</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Sign Out button */}
          <button
            onClick={handleSignOut}
            className="p-1.5 text-[#64748B] hover:text-rose-400 hover:bg-[#020305] rounded-md transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
