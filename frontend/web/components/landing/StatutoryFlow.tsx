'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Landmark, User, Compass, FileCheck, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

const ROLES = [
  {
    id: 'citizen',
    title: 'Citizen Applicant',
    subtitle: 'Cadastral Self-Service',
    icon: User,
    description:
      'Citizens submit title registration requests, upload verified deed credentials, define parcel boundaries, and monitor real-time audit trails from any device.',
    portalPath: '/citizen',
    portalLabel: 'Citizen Portal',
    responsibilities: [
      'Submit digital Certificate of Occupancy applications',
      'Track multi-stage spatial and oracle verification status',
      'Receive cryptographically signed ERC-721 deed token',
    ],
  },
  {
    id: 'surveyor',
    title: 'Licensed Surveyor',
    subtitle: 'Spatial Field Validation',
    icon: Compass,
    description:
      'SURCON-registered surveyors verify physical beacons, capture high-precision polygon vertices, and submit boundary geometry cleared of spatial overlap.',
    portalPath: '/login',
    portalLabel: 'Surveyor Field Console',
    responsibilities: [
      'Capture boundary beacon coordinates (EPSG:26331 / WGS84)',
      'Offline-capable fieldwork with auto-syncing MQTT queues',
      'Cryptographically sign parcel rings and survey plans',
    ],
  },
  {
    id: 'registrar',
    title: 'Land Registrar',
    subtitle: 'Deeds Adjudication',
    icon: FileCheck,
    description:
      'Registrars review automated spatial overlap clearance reports and oracle attestations before approving title deed minting to the Besu consortium ledger.',
    portalPath: '/registrar',
    portalLabel: 'Registrar Queue',
    responsibilities: [
      'Inspect dual-oracle institutional and community consensus scores',
      'Approve verified applications for on-chain deed minting',
      'Audit historical deeds and encumbrance chronologies',
    ],
  },
  {
    id: 'governor',
    title: 'State Governor',
    subtitle: 'Section 28 Statutory Authority',
    icon: ShieldAlert,
    description:
      'In strict compliance with the Land Use Act 1978, all land is vested in the State Governor. Only the Governor holds the statutory key for Section 28 revocations.',
    portalPath: '/governor',
    portalLabel: 'Executive Governance Console',
    responsibilities: [
      'Fiduciary constitutional trustee of all state lands',
      'Exercise Section 28 revocation for overriding public interest',
      'Mandatory on-chain justification and immutable audit logging',
    ],
  },
];

export function StatutoryFlow() {
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const current = ROLES.find((r) => r.id === activeRole) || ROLES[0];
  const Icon = current.icon;

  return (
    <section id="governance" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] mb-3">
            <Landmark className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span className="text-[12px] font-mono uppercase tracking-wider text-[#67E8F9]">
              Constitutional Framework
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F4F7FB] tracking-tight mb-4">
            Statutory Roles & Separation of Powers
          </h2>
          <p className="text-[#94A3B8] text-base sm:text-lg">
            Anagu maps the legal reality of the Nigerian Land Use Act (1978) directly into role-based 
            cryptographic smart contract permissions and multi-tier state checks.
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-8">
          {ROLES.map((role) => {
            const RoleIcon = role.icon;
            const isSelected = role.id === activeRole;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setActiveRole(role.id)}
                className={`p-4 rounded-[10px] text-left border transition-all duration-150 flex flex-col justify-between h-24 ${
                  isSelected
                    ? 'bg-[#0A0F16] border-[#38BDF8] shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                    : 'bg-[#05080D]/80 border-[rgba(91,133,167,0.18)] hover:border-[rgba(56,189,248,0.30)] text-[#94A3B8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <RoleIcon
                    className={`h-5 w-5 ${isSelected ? 'text-[#38BDF8]' : 'text-[#526174]'}`}
                  />
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-[#38BDF8] animate-pulse" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-xs sm:text-sm font-semibold ${
                      isSelected ? 'text-[#F4F7FB]' : 'text-[#94A3B8]'
                    }`}
                  >
                    {role.title}
                  </p>
                  <p className="text-[11px] font-mono text-[#526174] truncate">
                    {role.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Role Panel */}
        <div className="max-w-4xl mx-auto rounded-[12px] bg-[#0A0F16]/80 border border-[rgba(91,133,167,0.22)] p-6 sm:p-10 backdrop-blur-md shadow-[0_0_24px_rgba(56,189,248,0.08)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[rgba(91,133,167,0.18)]">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-[#05080D] border border-[rgba(56,189,248,0.30)] text-[#38BDF8]">
                <Icon className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#67E8F9]">
                  {current.subtitle}
                </span>
                <h3 className="text-2xl font-bold text-[#F4F7FB] mt-0.5">
                  {current.title}
                </h3>
                <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed max-w-xl">
                  {current.description}
                </p>
              </div>
            </div>

            <Link
              href={current.portalPath}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_20px_rgba(56,189,248,0.22)] transition-all shrink-0"
            >
              <span>{current.portalLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Core Responsibilities */}
          <div className="pt-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#526174] mb-3">
              Statutory System Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {current.responsibilities.map((resp, idx) => (
                <div
                  key={idx}
                  className="rounded-[8px] bg-[#05080D] p-4 border border-[rgba(91,133,167,0.16)] flex flex-col justify-start"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-[#38BDF8]" />
                    <span className="text-xs font-mono text-[#94A3B8]">
                      0{idx + 1}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#F4F7FB] leading-snug">
                    {resp}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
