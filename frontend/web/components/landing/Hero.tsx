'use client';

import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';

interface HeroProps {
  onExploreClick?: () => void;
  onVerifyClick?: () => void;
}

export function Hero({ onExploreClick }: HeroProps) {
  return (
    <section id="overview" className="relative pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Centered Atmospheric Radial Glow Layer */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-16 w-[600px] sm:w-[800px] h-[400px] sm:h-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0%,rgba(11,79,120,0.08)_45%,transparent_75%)] blur-3xl opacity-90 -z-10" 
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-3xl mx-auto flex flex-col items-center text-center">
          
          {/* Animated 360° Turning Image Behind Text (positioned safely below navbar) */}
          <div 
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[95px] sm:top-[115px] lg:top-[125px] -translate-x-1/2 -translate-y-1/2 w-[260px] sm:w-[340px] md:w-[380px] lg:w-[420px] aspect-square -z-10 flex items-center justify-center select-none"
          >
            {/* Luminous soft ambient halo */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18)_0%,rgba(11,79,120,0.08)_45%,transparent_72%)] blur-2xl" />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://res.cloudinary.com/sbja6tt8/image/upload/v1790153223/ChatGPT_Image_Sep_23_2026_09_37_46_AM.png"
              alt=""
              className="w-full h-full object-contain animate-spin-360 select-none pointer-events-none will-change-transform drop-shadow-[0_0_20px_rgba(56,189,248,0.20)]"
              style={{ animation: 'spin360 25s linear infinite', opacity: 0.5 }}
            />
          </div>

          {/* Centered Headline */}
          <h1 className="relative z-10 text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4F7FB] tracking-tight leading-[1.12] mb-5 drop-shadow-md">
            Cryptographic Land Registry &amp;{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4F7FB] via-[#67E8F9] to-[#38BDF8]">
              Digital Title Management
            </span>
          </h1>

          {/* Reduced, Centered Description */}
          <p className="relative z-10 text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-xl mb-8 backdrop-blur-[2px]">
            Secure, tamper-evident land titles backed by statutory governance and immutable blockchain verification.
          </p>

          {/* Two Centered Action Buttons: Register & Explore */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg bg-[#38BDF8] text-[#020305] text-[15px] font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200 active:scale-[0.98]"
            >
              <span>Register</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={onExploreClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-lg bg-[#0A0F16]/80 text-[#F4F7FB] text-[15px] font-medium border border-[rgba(148,163,184,0.24)] hover:border-[#38BDF8]/60 hover:text-[#67E8F9] hover:bg-[#0D141D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200 active:scale-[0.98]"
            >
              <span>Explore</span>
              <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
            </button>
          </div>

          {/* Centered Key Trust Metrics */}
          <div className="relative z-10 mt-14 pt-8 border-t border-[rgba(91,133,167,0.16)] w-full max-w-2xl grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#526174]">
                Zero Overlap
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#F4F7FB] mt-1">
                100%
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                PostGIS Topology
              </p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#526174]">
                Finality
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#F4F7FB] mt-1">
                &lt; 2.0s
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                IBFT 2.0 Consensus
              </p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#526174]">
                Custody
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#67E8F9] mt-1">
                Section 28
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Statutory Authority
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
