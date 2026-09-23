'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight, ShieldCheck, Database, Layers, Landmark } from 'lucide-react';

interface NavbarProps {
  onNavigateSection?: (sectionId: string) => void;
}

export function Navbar({ onNavigateSection }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (onNavigateSection) {
      onNavigateSection(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-[#020305]/85 backdrop-blur-md border-b border-[rgba(91,133,167,0.20)] shadow-[0_4px_24px_rgba(2,3,5,0.8)]'
          : 'bg-transparent border-b border-[rgba(91,133,167,0.12)]'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded-md py-1"
          >
            {/* Geometric Hexagon Glyph */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.25)] group-hover:border-[#38BDF8]/50 transition-colors">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[#38BDF8] transition-transform duration-300 group-hover:scale-105"
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
              {/* Subtle node glow bloom */}
              <div className="absolute inset-0 rounded-lg bg-[#38BDF8]/10 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-wider text-base sm:text-lg text-[#F4F7FB]">
                  ANAGU
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#67E8F9] px-1.5 py-0.5 rounded bg-[#0A0F16] border border-[rgba(56,189,248,0.25)]">
                  LUA &apos;78
                </span>
              </div>
              <span className="text-[11px] text-[#526174] font-medium hidden sm:block">
                Cadastral Title Ledger
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Main Navigation">
            <button
              onClick={() => handleNavClick('overview')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Overview
            </button>
            <button
              onClick={() => handleNavClick('verification')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Title Verification
            </button>
            <button
              onClick={() => handleNavClick('architecture')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Architecture
            </button>
            <button
              onClick={() => handleNavClick('governance')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Statutory Governance
            </button>
            <button
              onClick={() => handleNavClick('ledger')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Public Ledger
            </button>
            <button
              onClick={() => handleNavClick('contact')}
              className="px-3 py-2 text-[14px] font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              Contact
            </button>
          </nav>

          {/* Action Button & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="relative inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-[13px] sm:text-[14px] font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200 active:scale-[0.98]"
            >
              <span>Portal Access</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            {/* Mobile Menu Button */}
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
        <div className="md:hidden border-b border-[rgba(91,133,167,0.20)] bg-[#05080D]/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="py-2 border-b border-[rgba(91,133,167,0.15)] mb-2">
            <p className="text-[12px] font-mono uppercase tracking-wider text-[#526174]">
              Statutory Cadastral Framework
            </p>
          </div>
          <button
            onClick={() => handleNavClick('overview')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>Overview</span>
            <Layers className="h-4 w-4 text-[#526174]" />
          </button>
          <button
            onClick={() => handleNavClick('verification')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>Title Verification Engine</span>
            <ShieldCheck className="h-4 w-4 text-[#526174]" />
          </button>
          <button
            onClick={() => handleNavClick('architecture')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>System Architecture</span>
            <Database className="h-4 w-4 text-[#526174]" />
          </button>
          <button
            onClick={() => handleNavClick('governance')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>Statutory Governance</span>
            <Landmark className="h-4 w-4 text-[#526174]" />
          </button>
          <button
            onClick={() => handleNavClick('ledger')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>Public Ledger & Activity</span>
            <Layers className="h-4 w-4 text-[#526174]" />
          </button>
          <button
            onClick={() => handleNavClick('contact')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-medium text-[#F4F7FB] hover:bg-[#0A0F16] hover:text-[#67E8F9] rounded-md transition-colors text-left"
          >
            <span>Ministry Contact</span>
            <ArrowRight className="h-4 w-4 text-[#526174]" />
          </button>

          <div className="pt-3">
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[8px] bg-[#38BDF8] text-[#020305] text-[14px] font-semibold border border-[rgba(103,232,249,0.45)]"
            >
              <span>Sign In to Cadastral Console</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
