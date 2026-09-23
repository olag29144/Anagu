'use client';

import { ShieldCheck, Database, Layers, Landmark, Cpu, Radio, GitMerge, FileCode, CheckCircle2 } from 'lucide-react';

const ARCHITECTURE_PILLARS = [
  {
    icon: Database,
    title: 'Hyperledger Besu IBFT 2.0',
    tag: 'CONSENSUS LEDGER',
    description:
      'Permissioned sovereign consortium network operating Istanbul Byzantine Fault Tolerance. Instant transaction finality (<2s) with zero speculative gas token volatility.',
    specs: ['IBFT 2.0 Consensus', 'Zero Gas Volatility', 'Validator Whitelisting'],
  },
  {
    icon: Layers,
    title: 'PostGIS Spatial Engine',
    tag: 'CADASTRE NON-OVERLAP',
    description:
      'Sub-millimeter topological verification on parcel coordinate rings. Enforces automated ST_Overlaps and ST_Contains checks preventing double-titling and boundary encroachment.',
    specs: ['WGS84 & EPSG:26331', 'ST_Overlaps Zero Check', 'Geometric Hash Rings'],
  },
  {
    icon: GitMerge,
    title: 'Dual-Oracle Attestation',
    tag: 'MULTI-STAKEHOLDER',
    description:
      'Cross-validates formal state deeds with customary community knowledge. Combines Ministry deed registers and traditional ruler council consensus into a single cryptographic score.',
    specs: ['Institutional Source', 'Customary Council', 'Cryptographic Quorum'],
  },
  {
    icon: Landmark,
    title: 'Section 28 Statutory Custody',
    tag: 'NIGERIAN LAND USE ACT',
    description:
      'Digital translation of Land Use Act 1978. Only the State Governor holds statutory revocation authority for overriding public interest, backed by an immutable tamper-evident trail.',
    specs: ['S.28 Public Interest', 'Statutory Audit Trail', 'Governor Role Guard'],
  },
  {
    icon: FileCode,
    title: 'ERC-721 Digital Title Deeds',
    tag: 'NON-FUNGIBLE CADASTRE',
    description:
      'Every approved parcel mints an on-chain ERC-721 LandTitleNFT. Bound permanently to surveyor coordinates, spatial hash, grantee identity, and encumbrance metadata.',
    specs: ['ERC-721 Standard', 'Deed Token Minting', 'Transfer Restraints'],
  },
  {
    icon: Radio,
    title: 'Field Surveyor Mesh Sync',
    tag: 'OFFLINE-FIRST MQTT',
    description:
      'Engineered for remote local government areas. Mobile surveyor applications capture boundary points offline with SQLite queuing and auto-publish via MQTT upon cell connectivity.',
    specs: ['MQTT Telemetry', 'Encrypted Queueing', 'Remote LGA Support'],
  },
];

export function ArchitectureGrid() {
  return (
    <section id="architecture" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] mb-3">
            <Cpu className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span className="text-[12px] font-mono uppercase tracking-wider text-[#67E8F9]">
              Enterprise Stack
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F4F7FB] tracking-tight mb-4">
            Architected for Sovereign Integrity & Statutory Precision
          </h2>
          <p className="text-[#94A3B8] text-base sm:text-lg">
            Unlike public speculative chains, Anagu is built specifically for land administration ministries,
            surveyor generals, and citizens needing absolute legal non-repudiation.
          </p>
        </div>

        {/* 6-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ARCHITECTURE_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-[12px] bg-[#0A0F16]/78 border border-[rgba(91,133,167,0.18)] p-6 sm:p-7 hover:border-[rgba(56,189,248,0.35)] hover:shadow-[0_0_24px_rgba(56,189,248,0.14)] transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Icon & Tag */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.24)] group-hover:border-[#38BDF8]/50 group-hover:text-[#67E8F9] transition-colors text-[#94A3B8]">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <span className="text-[10px] font-mono tracking-wider uppercase text-[#67E8F9] px-2 py-0.5 rounded bg-[#020305] border border-[rgba(56,189,248,0.20)]">
                      {pillar.tag}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-semibold text-[#F4F7FB] mb-2.5 group-hover:text-[#67E8F9] transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">
                    {pillar.description}
                  </p>
                </div>

                {/* Specs Pill List */}
                <div className="pt-4 border-t border-[rgba(91,133,167,0.14)] flex flex-wrap gap-2">
                  {pillar.specs.map((spec, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[#526174] group-hover:text-[#94A3B8] transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[#38BDF8]" />
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
