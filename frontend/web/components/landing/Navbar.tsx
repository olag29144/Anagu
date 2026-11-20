'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, MapPin, Home, User, UserPlus, LogOut } from 'lucide-react';
import {
  getActiveUserAccount,
  clearActiveUserAccount,
  type UserAccount,
} from '@/lib/user-store';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const syncUser = () => {
      setActiveUser(getActiveUserAccount());
    };
    syncUser();
    window.addEventListener('anagu-user-changed', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('anagu-user-changed', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = () => {
    clearActiveUserAccount();
    setActiveUser(null);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-[#020305]/90 backdrop-blur-md border-b border-[rgba(91,133,167,0.20)] shadow-[0_4px_24px_rgba(2,3,5,0.8)]'
          : 'bg-[#020305]/60 backdrop-blur-sm border-b border-[rgba(91,133,167,0.12)]'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            href={activeUser ? '/dashboard' : '/'}
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded-md py-1 whitespace-nowrap shrink-0"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.25)] group-hover:border-[#38BDF8]/50 transition-colors">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[#38BDF8]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
                <polyline points="12 6 12 12 18 15" />
                <circle cx="12" cy="12" r="1.5" fill="#67E8F9" />
              </svg>
            </div>
            <span className="font-semibold tracking-wider text-base sm:text-lg text-[#F4F7FB] whitespace-nowrap shrink-0">
              ANAGU
            </span>
          </Link>

          {/* Zone 2: Public Links (shown ONLY when signed out; hidden once user signs in) */}
          {!activeUser && (
            <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
              <Link
                href="/"
                className={`text-[14px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  pathname === '/'
                    ? 'text-[#38BDF8]'
                    : 'text-[#94A3B8] hover:text-[#67E8F9]'
                }`}
              >
                Home
              </Link>
              <Link
                href="/explore"
                className={`text-[14px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  pathname === '/explore'
                    ? 'text-[#38BDF8]'
                    : 'text-[#94A3B8] hover:text-[#67E8F9]'
                }`}
              >
                Explore Land
              </Link>
            </nav>
          )}

          {/* Zone 3: User Account Action (no Register Land button at the top when signed in) */}
          <div className="flex items-center gap-3 shrink-0">
            {activeUser ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.28)] hover:border-[#38BDF8]/50 text-xs font-medium text-[#E2E8F0] transition-colors whitespace-nowrap shrink-0 max-w-[200px]"
                title={`Open account for ${activeUser.fullName}`}
              >
                <User className="h-3.5 w-3.5 text-[#38BDF8] shrink-0" />
                <span className="truncate">{activeUser.fullName}</span>
              </Link>
            ) : (
              <Link
                href="/dashboard?mode=signup"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-[13px] sm:text-[14px] font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200 active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Register an Account</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] text-[#94A3B8] hover:text-[#67E8F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[rgba(91,133,167,0.20)] bg-[#05080D]/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-1">
          {!activeUser ? (
            <>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors"
              >
                <span>Home</span>
                <Home className="h-4 w-4 text-[#38BDF8]" />
              </Link>
              <Link
                href="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors"
              >
                <span>Explore Land</span>
                <MapPin className="h-4 w-4 text-[#38BDF8]" />
              </Link>

              <div className="pt-3">
                <Link
                  href="/dashboard?mode=signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-[8px] bg-[#38BDF8] text-[#020305] text-[14px] font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register an Account</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.3)] text-[#F4F7FB] text-[14px] font-medium"
              >
                <User className="h-4 w-4 text-[#38BDF8]" />
                <span>My Dashboard ({activeUser.fullName})</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-[8px] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-rose-300 text-xs font-medium"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
