'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Cpu, CheckCircle2, ChevronRight, Hash } from 'lucide-react';

interface HeroProps {
  onExploreClick?: () => void;
  onVerifyClick?: () => void;
}

export function Hero({ onExploreClick, onVerifyClick }: HeroProps) {
  return (
    <section id="overview" className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-36 overflow-hidden">
      {/* Background Honeycomb Glow Focus Layer */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -right-20 top-20 w-[550px] sm:w-[700px] h-[550px] sm:h-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14)_0%,rgba(11,79,120,0.08)_40%,transparent_75%)] blur-3xl opacity-90 -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute left-1/4 top-1/3 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle_at_center,rgba(11,79,120,0.10)_0%,transparent_70%)] blur-2xl -z-10" 
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Main Hero Column (Left) */}
          <div className="lg:col-span-7 flex flex-col items-start z-10">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0A0F16]/90 border border-[rgba(56,189,248,0.30)] mb-6 shadow-[0_0_15px_rgba(56,189,248,0.08)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#67E8F9] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38BDF8]" />
              </span>
              <span className="text-[11px] sm:text-[12px] font-mono font-medium uppercase tracking-wider text-[#67E8F9]">
                NIGERIAN LAND USE ACT (1978) COMPLIANT
              </span>
              <span className="text-[10px] text-[#526174] border-l border-[rgba(91,133,167,0.3)] pl-2 hidden sm:inline">
                IBFT 2.0 PROTOCOL
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-bold text-[#F4F7FB] tracking-tight leading-[1.08] mb-6">
              Next-generation{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4F7FB] via-[#67E8F9] to-[#38BDF8]">
                cryptographic land administration
              </span>{' '}
              for sovereign states.
            </h1>

            {/* Supporting Paragraph */}
            <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed max-w-2xl mb-8">
              Anagu bridges sovereign statutory governance with an enterprise permissioned blockchain. 
              Enforcing sub-millimeter PostGIS spatial non-overlap, dual-oracle community consensus, and 
              tamper-evident ERC-721 digital title certificates under statutory gubernatorial custody.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <button
                type="button"
                onClick={onVerifyClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-12 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-[15px] font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200 active:scale-[0.98]"
              >
                <span>Verify Parcel Title</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onExploreClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-[8px] bg-[#0A0F16]/80 text-[#F4F7FB] text-[15px] font-medium border border-[rgba(148,163,184,0.24)] hover:border-[#38BDF8]/60 hover:text-[#67E8F9] hover:bg-[#0D141D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] transition-all duration-200"
              >
                <span>View Architecture</span>
                <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
              </button>
            </div>

            {/* Key trust indicators */}
            <div className="mt-12 pt-8 border-t border-[rgba(91,133,167,0.18)] w-full grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-[12px] font-mono uppercase tracking-wider text-[#526174]">
                  Zero Double-Allocation
                </p>
                <p className="text-xl sm:text-2xl font-bold text-[#F4F7FB] mt-0.5">
                  100%
                </p>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">
                  PostGIS topological check
                </p>
              </div>

              <div>
                <p className="text-[12px] font-mono uppercase tracking-wider text-[#526174]">
                  Consensus Finality
                </p>
                <p className="text-xl sm:text-2xl font-bold text-[#F4F7FB] mt-0.5">
                  &lt; 2.0s
                </p>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">
                  Hyperledger Besu IBFT 2.0
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[12px] font-mono uppercase tracking-wider text-[#526174]">
                  Statutory Custody
                </p>
                <p className="text-xl sm:text-2xl font-bold text-[#67E8F9] mt-0.5">
                  Section 28
                </p>
                <p className="text-[12px] text-[#94A3B8] mt-0.5">
                  Governor sole revocability
                </p>
              </div>
            </div>
          </div>

          {/* High-Tech Telemetry Node Display (Right Column) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-[12px] bg-[#0A0F16]/85 border border-[rgba(91,133,167,0.22)] p-6 shadow-[0_0_30px_rgba(56,189,248,0.10)] backdrop-blur-md">
              {/* Header bar of node card */}
              <div className="flex items-center justify-between pb-4 border-b border-[rgba(91,133,167,0.18)]">
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] animate-pulse" />
                  <span className="text-[13px] font-mono font-medium text-[#F4F7FB]">
                    ANAGU-NODE-LAGOS-01
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#38BDF8] bg-[#020305] px-2 py-0.5 rounded border border-[rgba(56,189,248,0.25)]">
                  SYNCHRONIZED
                </span>
              </div>

              {/* Status metrics grid */}
              <div className="space-y-4 my-5">
                <div className="flex items-center justify-between py-2 border-b border-[rgba(91,133,167,0.12)]">
                  <span className="text-[13px] text-[#94A3B8]">Consensus Protocol</span>
                  <span className="text-[13px] font-mono text-[#F4F7FB]">Enterprise Besu IBFT 2.0</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[rgba(91,133,167,0.12)]">
                  <span className="text-[13px] text-[#94A3B8]">Spatial Topology Ring</span>
                  <span className="text-[13px] font-mono text-[#67E8F9] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                    ST_Overlaps = 0
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[rgba(91,133,167,0.12)]">
                  <span className="text-[13px] text-[#94A3B8]">Dual-Oracle Validation</span>
                  <span className="text-[13px] font-mono text-[#F4F7FB]">Deed Registry + Traditional</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[rgba(91,133,167,0.12)]">
                  <span className="text-[13px] text-[#94A3B8]">Title Certificate Type</span>
                  <span className="text-[13px] font-mono text-[#F4F7FB]">ERC-721 Non-Fungible Deed</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-[#94A3B8]">Audit Trail Merkle Root</span>
                  <span className="text-[12px] font-mono text-[#526174]">0x7c9f...4a12</span>
                </div>
              </div>

              {/* Mini Interactive Preview Snippet */}
              <div className="rounded-[8px] bg-[#05080D] p-3 border border-[rgba(91,133,167,0.16)]">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#526174] mb-1.5">
                  <span>LAST RATIFIED TITLE</span>
                  <span>BLOCK #1,048,290</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#38BDF8]" />
                    <span className="text-[13px] font-mono font-medium text-[#F4F7FB]">
                      NG-LAG-VI-2024-0042
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#67E8F9]">
                    CERTIFICATE ISSUED
                  </span>
                </div>
              </div>

              {/* Action link */}
              <div className="mt-4 pt-3 text-center">
                <Link
                  href="/login"
                  className="text-[12px] text-[#38BDF8] hover:text-[#67E8F9] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>Authenticate to Registry Console</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
