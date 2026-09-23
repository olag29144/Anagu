'use client';

import Link from 'next/link';
import { ShieldCheck, ArrowUp, Globe, FileText, Database, Landmark } from 'lucide-react';

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[rgba(91,133,167,0.18)] bg-[#020305] pt-16 pb-12 relative text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[rgba(91,133,167,0.14)]">
          {/* Col 1 & 2: Brand & Description */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A0F16] border border-[rgba(56,189,248,0.30)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[#38BDF8]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
                  <polyline points="12 6 12 12 18 15" />
                  <circle cx="12" cy="12" r="1.5" fill="#67E8F9" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-wider text-[#F4F7FB]">
                ANAGU
              </span>
              <span className="text-[10px] font-mono uppercase text-[#67E8F9] px-1.5 py-0.5 rounded bg-[#0A0F16] border border-[rgba(56,189,248,0.25)]">
                CADASTRE 2.0
              </span>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed max-w-md mb-6">
              A sovereign enterprise permissioned blockchain for digital land registration, 
              spatial topological verification, and statutory title administration across the Federal Republic of Nigeria.
            </p>

            <div className="flex items-center gap-2 text-[#526174]">
              <ShieldCheck className="h-4 w-4 text-[#38BDF8]" />
              <span className="font-mono text-[11px]">
                Land Use Act (1978) · Cap L5 LFN 2004 Validated
              </span>
            </div>
          </div>

          {/* Col 3: Statutory Portals */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#F4F7FB] mb-4">
              Portals & Consoles
            </h4>
            <ul className="space-y-2.5 text-[#94A3B8]">
              <li>
                <Link href="/citizen" className="hover:text-[#67E8F9] transition-colors">
                  Citizen Self-Service
                </Link>
              </li>
              <li>
                <Link href="/citizen/submit" className="hover:text-[#67E8F9] transition-colors">
                  Submit Parcel Application
                </Link>
              </li>
              <li>
                <Link href="/registrar" className="hover:text-[#67E8F9] transition-colors">
                  Land Registrar Review
                </Link>
              </li>
              <li>
                <Link href="/governor" className="hover:text-[#67E8F9] transition-colors">
                  Governor Executive Console
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#67E8F9] transition-colors">
                  System Registry Admin
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Architecture */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#F4F7FB] mb-4">
              Ledger Specs
            </h4>
            <ul className="space-y-2.5 text-[#94A3B8]">
              <li>
                <a href="#architecture" className="hover:text-[#67E8F9] transition-colors">
                  Hyperledger Besu (IBFT 2.0)
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#67E8F9] transition-colors">
                  PostGIS Spatial Clearance
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-[#67E8F9] transition-colors">
                  Dual-Oracle Attestation
                </a>
              </li>
              <li>
                <a href="#governance" className="hover:text-[#67E8F9] transition-colors">
                  Section 28 Revocation Rules
                </a>
              </li>
              <li>
                <a href="#ledger" className="hover:text-[#67E8F9] transition-colors">
                  Public Merkle Audit Trails
                </a>
              </li>
            </ul>
          </div>

          {/* Col 5: Security & Governance */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#F4F7FB] mb-4">
              Standards & Legal
            </h4>
            <ul className="space-y-2.5 text-[#94A3B8]">
              <li>
                <span className="text-[#526174]">SURCON Geodesy Standards</span>
              </li>
              <li>
                <span className="text-[#526174]">EPSG:26331 (Minna / UTM 31N)</span>
              </li>
              <li>
                <span className="text-[#526174]">ISO 19152 (LADM) Domain Model</span>
              </li>
              <li>
                <span className="text-[#526174]">NDPR Data Privacy Compliant</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright and back-to-top */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#526174]">
          <p>© 2026 Anagu Consortium. Designed for Sovereign Land Administration.</p>
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1 text-[#94A3B8] hover:text-[#67E8F9] transition-colors focus-visible:outline-none"
            aria-label="Scroll back to top"
          >
            <span>Back to top</span>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
