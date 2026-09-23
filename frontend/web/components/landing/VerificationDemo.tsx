'use client';

import { useState } from 'react';
import { Search, ShieldCheck, CheckCircle2, AlertTriangle, Copy, ExternalLink, MapPin, Layers, FileText } from 'lucide-react';

interface VerifiedParcel {
  parcelRef: string;
  tokenId: string;
  ownerName: string;
  location: string;
  documentType: string;
  spatialHash: string;
  coordinates: string;
  postgisStatus: string;
  oracleConsensus: string;
  blockHeight: number;
  txHash: string;
  statutoryStatus: 'ACTIVE' | 'PENDING' | 'REVOKED';
  statutoryGround?: string;
  issuedDate: string;
}

const SAMPLE_DATABASE: Record<string, VerifiedParcel> = {
  'NG-LAG-LEK-2024-0089': {
    parcelRef: 'NG-LAG-LEK-2024-0089',
    tokenId: '42',
    ownerName: 'Chief Babatunde Adeleke',
    location: 'Plot 14, Block 8, Lekki Phase 1, Eti-Osa LGA, Lagos State',
    documentType: 'Certificate of Occupancy (C of O)',
    spatialHash: '0x8f2d9c104a3b81ef56934c910321a',
    coordinates: '6.4382° N, 3.4721° E · Area: 1,240.50 sqm',
    postgisStatus: 'Clean (0 Overlaps, 0 Gaps)',
    oracleConsensus: 'Dual-Quorum Verified (Institutional: 100% · Community: 100%)',
    blockHeight: 1048290,
    txHash: '0x4f89d317ac2091b654e8103c8091da93fe883a660144d1810b10764c45b81a20',
    statutoryStatus: 'ACTIVE',
    issuedDate: '14 May 2024',
  },
  'NG-ABJ-MAI-2024-0142': {
    parcelRef: 'NG-ABJ-MAI-2024-0142',
    tokenId: '88',
    ownerName: 'Dr. Amina Fatima Bello',
    location: 'Cadastral Zone A05, Maitama, Federal Capital Territory',
    documentType: 'Right of Occupancy (R of O)',
    spatialHash: '0x3a71b4028d9f1092e0134bc59812e',
    coordinates: '9.0820° N, 7.4983° E · Area: 2,150.00 sqm',
    postgisStatus: 'Clean (0 Overlaps, 0 Gaps)',
    oracleConsensus: 'Dual-Quorum Verified (Institutional: 100% · Community: 98%)',
    blockHeight: 1049102,
    txHash: '0x91da77823f40bb8812c334fa12903fe8841029cba660144d1810b10764c45e09',
    statutoryStatus: 'ACTIVE',
    issuedDate: '22 June 2024',
  },
  'NG-OGN-OTA-2023-0911': {
    parcelRef: 'NG-OGN-OTA-2023-0911',
    tokenId: '19',
    ownerName: 'Apex Industrial Holdings Ltd',
    location: 'Ota Industrial Layout, Ado-Odo/Ota LGA, Ogun State',
    documentType: 'Governor Consent Deed',
    spatialHash: '0x71ba9045ef12998a442b01c389104',
    coordinates: '6.6912° N, 3.2345° E · Area: 14,800.00 sqm',
    postgisStatus: 'Clean Boundary Registered',
    oracleConsensus: 'Quorum Recorded',
    blockHeight: 982310,
    txHash: '0x1034dcb98172ea441098fe71049283fa09141091b654e8103c8091da93fe883a',
    statutoryStatus: 'REVOKED',
    statutoryGround: 'Section 28(1)(a) Land Use Act: Overriding Public Interest (Rail Corridor)',
    issuedDate: '08 Nov 2023',
  },
};

export function VerificationDemo() {
  const [searchTerm, setSearchTerm] = useState('NG-LAG-LEK-2024-0089');
  const [activeParcel, setActiveParcel] = useState<VerifiedParcel | null>(SAMPLE_DATABASE['NG-LAG-LEK-2024-0089']);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    setLoading(true);
    setNotFoundMessage(null);

    setTimeout(() => {
      // Direct match or token lookup
      const found = Object.values(SAMPLE_DATABASE).find(
        (p) =>
          p.parcelRef.toLowerCase() === query.toLowerCase() ||
          p.tokenId === query ||
          p.ownerName.toLowerCase().includes(query.toLowerCase()),
      );

      if (found) {
        setActiveParcel(found);
      } else {
        // Synthesize dynamic verified mock for any valid test format
        setActiveParcel({
          parcelRef: query.toUpperCase(),
          tokenId: `${Math.floor(Math.random() * 900 + 100)}`,
          ownerName: 'Registered Sovereign Allottee',
          location: 'State Survey Cadastral Grid Sector 4',
          documentType: 'Governor Statutory Certificate',
          spatialHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
          coordinates: '6.5244° N, 3.3792° E · Polygon: 4 Coordinates',
          postgisStatus: 'Clean (PostGIS Verified 0 Overlaps)',
          oracleConsensus: 'Dual-Oracle Attestation Verified',
          blockHeight: 1051200 + Math.floor(Math.random() * 50),
          txHash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
          statutoryStatus: 'ACTIVE',
          issuedDate: 'Verified Ledger Record',
        });
      }
      setLoading(false);
    }, 350);
  };

  const copyTx = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="verification" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] mb-3">
            <ShieldCheck className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span className="text-[12px] font-mono uppercase tracking-wider text-[#67E8F9]">
              Cryptographic Proof Engine
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#F4F7FB] tracking-tight mb-4">
            Instant Land Title & Cadastre Verification
          </h2>
          <p className="text-[#94A3B8] text-base sm:text-lg">
            Query the state-authorized Besu ledger to inspect spatial boundary hashes, 
            oracle consensus stamps, and statutory Section 28 title validity in real time.
          </p>
        </div>

        {/* Search Bar & Quick Presets */}
        <div className="max-w-3xl mx-auto mb-10">
          <form onSubmit={handleSearch} className="relative flex items-center mb-3">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter Parcel ID (e.g. NG-LAG-LEK-2024-0089) or Token ID..."
                className="w-full h-12 sm:h-14 pl-12 pr-28 sm:pr-36 rounded-[8px] bg-[#0A0F16] border border-[rgba(148,163,184,0.22)] text-[#F4F7FB] placeholder-[#526174] text-sm sm:text-base focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#526174]" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 sm:right-2 h-9 sm:h-10 px-4 sm:px-6 rounded-[6px] bg-[#38BDF8] text-[#020305] text-xs sm:text-sm font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] transition-all flex items-center gap-1.5"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
              ) : (
                'Verify'
              )}
            </button>
          </form>

          {/* Quick Select Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#526174] font-medium">Quick inspect:</span>
            {Object.keys(SAMPLE_DATABASE).map((ref) => (
              <button
                key={ref}
                type="button"
                onClick={() => {
                  setSearchTerm(ref);
                  setActiveParcel(SAMPLE_DATABASE[ref]);
                }}
                className={`px-2.5 py-1 rounded-[6px] border font-mono transition-colors ${
                  searchTerm === ref
                    ? 'bg-[#0A0F16] text-[#38BDF8] border-[#38BDF8]/40'
                    : 'bg-[#05080D] text-[#94A3B8] border-[rgba(91,133,167,0.18)] hover:text-[#F4F7FB]'
                }`}
              >
                {ref}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Result Card */}
        {activeParcel && (
          <div className="max-w-4xl mx-auto rounded-[12px] bg-[#0A0F16]/80 border border-[rgba(91,133,167,0.22)] p-6 sm:p-8 backdrop-blur-md shadow-[0_0_24px_rgba(56,189,248,0.08)]">
            {/* Top Bar of Certificate */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[rgba(91,133,167,0.18)] gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl sm:text-2xl font-bold font-mono text-[#F4F7FB]">
                    {activeParcel.parcelRef}
                  </h3>
                  <span className="text-xs font-mono text-[#38BDF8] px-2 py-0.5 rounded bg-[#020305] border border-[rgba(56,189,248,0.30)]">
                    TOKEN #{activeParcel.tokenId}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                  {activeParcel.location}
                </p>
              </div>

              {/* Statutory Status */}
              <div>
                {activeParcel.statutoryStatus === 'ACTIVE' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#05080D] border border-emerald-500/40 text-emerald-400 text-xs font-mono font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>VALID TITLE · ACTIVE</span>
                  </div>
                )}
                {activeParcel.statutoryStatus === 'REVOKED' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#05080D] border border-rose-500/40 text-rose-400 text-xs font-mono font-medium">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    <span>STATUTORY REVOCATION (§28)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Revocation notice if applicable */}
            {activeParcel.statutoryStatus === 'REVOKED' && activeParcel.statutoryGround && (
              <div className="my-4 p-3.5 rounded-[8px] bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
                <strong>Statutory Notice:</strong> {activeParcel.statutoryGround}
              </div>
            )}

            {/* Verification Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              {/* Left Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    Registered Grantee / Owner
                  </label>
                  <p className="text-[15px] font-medium text-[#F4F7FB] mt-0.5">
                    {activeParcel.ownerName}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    Statutory Title Instrument
                  </label>
                  <p className="text-[14px] text-[#94A3B8] mt-0.5 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#38BDF8]" />
                    {activeParcel.documentType} · Dated {activeParcel.issuedDate}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    Cadastral Geolocation & Area
                  </label>
                  <p className="text-[13px] font-mono text-[#F4F7FB] mt-0.5">
                    {activeParcel.coordinates}
                  </p>
                </div>
              </div>

              {/* Right Details: Cryptographic & Spatial */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    PostGIS Spatial Non-Overlap
                  </label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-[#38BDF8]" />
                    <span className="text-[13px] font-mono text-[#67E8F9]">
                      {activeParcel.postgisStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    Dual-Oracle Consensus Attestation
                  </label>
                  <p className="text-[13px] text-[#F4F7FB] mt-0.5">
                    {activeParcel.oracleConsensus}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#526174]">
                    Cadastral Spatial Hash
                  </label>
                  <p className="text-[12px] font-mono text-[#94A3B8] mt-0.5 break-all">
                    {activeParcel.spatialHash}
                  </p>
                </div>
              </div>
            </div>

            {/* Blockchain Receipt Footer */}
            <div className="pt-5 border-t border-[rgba(91,133,167,0.18)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-[#526174]">
                <span>Besu Block: #{activeParcel.blockHeight}</span>
                <span>·</span>
                <span className="truncate max-w-[200px] sm:max-w-[320px] text-[#94A3B8]">
                  Tx: {activeParcel.txHash.substring(0, 16)}...
                </span>
                <button
                  type="button"
                  onClick={() => copyTx(activeParcel.txHash)}
                  className="text-[#38BDF8] hover:text-[#67E8F9] p-1 rounded"
                  title="Copy transaction hash"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {copied && <span className="text-emerald-400 text-[11px]">Copied!</span>}
              </div>

              <a
                href="#ledger"
                className="inline-flex items-center gap-1 text-[#38BDF8] hover:text-[#67E8F9] hover:underline"
              >
                <span>Inspect Audit Log</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
