'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { apiCall } from '@/lib/api';
import { PortalHeader } from '@/components/portal-header';
import { CheckCircle2, ArrowLeft, Sparkles, MapPin, FileText, User } from 'lucide-react';

interface SubmitApplicationResponse {
  id: string;
}

export default function SubmitApplicationPage() {
  const [fields, setFields] = useState({
    ownerName: '',
    documentNumber: '',
    documentType: 'Certificate of Occupancy',
    issuingAuthority: 'Lagos State Lands Bureau',
    parcelRef: '',
    ownerWalletAddress: '',
    parcelCoordinates: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  // Helper to pre-populate valid Nigerian cadastral parcel coordinates & details
  const handleAutoFillCadastralSample = () => {
    const rand = Math.floor(100 + Math.random() * 899);
    setFields({
      ownerName: 'Chief Babatunde Adeleke',
      documentNumber: `LASG/LUAC/2026/${rand}`,
      documentType: 'Certificate of Occupancy',
      issuingAuthority: 'Lagos State Ministry of Physical Planning & Urban Development',
      parcelRef: `LAG-ETI-2026-${rand}`,
      ownerWalletAddress: '0x71C83812a19f20108A456789b910123456789012',
      parcelCoordinates: JSON.stringify(
        [
          [3.5284, 6.4421],
          [3.5295, 6.4421],
          [3.5295, 6.4432],
          [3.5284, 6.4432],
          [3.5284, 6.4421],
        ],
        null,
        2,
      ),
    });
    setError(null);
  };

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validate coordinate JSON before sending
    let parsedCoordinates: [number, number][];
    try {
      parsedCoordinates = JSON.parse(fields.parcelCoordinates);
      if (!Array.isArray(parsedCoordinates) || parsedCoordinates.length < 3) {
        throw new Error('Must be an array of at least 3 coordinate pairs.');
      }
    } catch (err) {
      setError(
        `Invalid coordinates: ${err instanceof Error ? err.message : 'Must be a JSON array of [lng, lat] pairs.'}`,
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ownerName: fields.ownerName.trim(),
        documentNumber: fields.documentNumber.trim(),
        documentType: fields.documentType.trim(),
        issuingAuthority: fields.issuingAuthority.trim(),
        parcelRef: fields.parcelRef.trim(),
        ownerWalletAddress: fields.ownerWalletAddress.trim(),
        parcelRing: { coordinates: parsedCoordinates },
      };

      const result = await apiCall<SubmitApplicationResponse>('/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setApplicationId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
      <PortalHeader currentRoleTitle="Submit Land Title Application" />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/citizen"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to My Applications</span>
          </Link>
          <button
            type="button"
            onClick={handleAutoFillCadastralSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 hover:bg-[#38BDF8]/20 text-xs font-mono transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-fill Valid Cadastral Sample</span>
          </button>
        </div>

        {/* Success modal / card */}
        {applicationId ? (
          <div className="rounded-xl bg-[#0A0F16] p-8 border border-emerald-500/40 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-[#F4F7FB]">Application Successfully Queued</h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Your land title dossier has been submitted to the Nigerian Cadastre Pipeline.
            </p>
            <div className="my-5 inline-block rounded-lg bg-[#020305] border border-[#1E293B] px-4 py-2 font-mono text-xs text-[#38BDF8]">
              Docket Number: {applicationId}
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                href="/citizen"
                className="rounded-lg bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-[#020305] hover:bg-[#67E8F9] transition-all"
              >
                Return to Applications
              </Link>
              <Link
                href={`/audit/${applicationId}`}
                className="rounded-lg border border-[#1E293B] px-4 py-2 text-xs font-mono text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#1E293B]/60 transition-all"
              >
                Inspect Ledger Audit →
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#0A0F16] p-7 border border-[#1E293B] shadow-xl">
            <div className="mb-6 pb-4 border-b border-[#1E293B]">
              <h1 className="text-lg font-bold text-[#F4F7FB]">Cadastral Parcel Submission</h1>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Submit legal title documentation and WGS 84 polygon ring coordinates for PostGIS collision checks.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-lg bg-rose-950/30 border border-rose-500/40 p-3.5 text-xs text-rose-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Owner Information */}
              <fieldset>
                <legend className="mb-3 text-xs font-mono uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>1. Titleholder Information</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ownerName" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Legal Owner Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      required
                      value={fields.ownerName}
                      onChange={handleChange}
                      placeholder="e.g. Chief Babatunde Adeleke"
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ownerWalletAddress" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Titleholder Wallet (ERC-721 Recipient) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="ownerWalletAddress"
                      name="ownerWalletAddress"
                      type="text"
                      required
                      value={fields.ownerWalletAddress}
                      onChange={handleChange}
                      placeholder="0x71C...a19f"
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs font-mono text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Title Document Information */}
              <fieldset>
                <legend className="mb-3 text-xs font-mono uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>2. Statutory Document Details</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="documentNumber" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Document Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="documentNumber"
                      name="documentNumber"
                      type="text"
                      required
                      value={fields.documentNumber}
                      onChange={handleChange}
                      placeholder="e.g. LASG/LUAC/2026/0412"
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="documentType" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Statutory Instrument <span className="text-rose-400">*</span>
                    </label>
                    <select
                      id="documentType"
                      name="documentType"
                      value={fields.documentType}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    >
                      <option value="Certificate of Occupancy">Certificate of Occupancy (C of O)</option>
                      <option value="Governor Consent">Governor Consent</option>
                      <option value="Deed of Assignment">Deed of Assignment</option>
                      <option value="Right of Occupancy">Right of Occupancy (R of O)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="issuingAuthority" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Issuing Ministry / Bureau Authority <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="issuingAuthority"
                      name="issuingAuthority"
                      type="text"
                      required
                      value={fields.issuingAuthority}
                      onChange={handleChange}
                      placeholder="e.g. Lagos State Lands Bureau"
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Parcel & Spatial Coordinates */}
              <fieldset>
                <legend className="mb-3 text-xs font-mono uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>3. Cadastral Coordinates & PostGIS Ring</span>
                </legend>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="parcelRef" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Cadastral Parcel Reference <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="parcelRef"
                      name="parcelRef"
                      type="text"
                      required
                      value={fields.parcelRef}
                      onChange={handleChange}
                      placeholder="e.g. LAG-ETI-2026-00412"
                      className="w-full h-10 px-3 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs font-mono text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="parcelCoordinates" className="block text-xs font-mono text-[#94A3B8] mb-1">
                      Polygon Boundary Ring (WGS 84, EPSG:4326) <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      id="parcelCoordinates"
                      name="parcelCoordinates"
                      rows={5}
                      required
                      value={fields.parcelCoordinates}
                      onChange={handleChange}
                      placeholder="[[3.5284, 6.4421], [3.5295, 6.4421], [3.5295, 6.4432], [3.5284, 6.4432], [3.5284, 6.4421]]"
                      className="w-full px-3 py-2 rounded-lg bg-[#05080D] border border-[#1E293B] text-xs font-mono text-[#38BDF8] focus:border-[#38BDF8] focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-[#64748B] font-mono">
                      First and last point must match to close boundary polygon.
                    </p>
                  </div>
                </div>
              </fieldset>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E293B]">
                <Link
                  href="/citizen"
                  className="px-4 py-2 text-xs font-mono text-[#94A3B8] hover:text-[#F4F7FB]"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] transition-all disabled:opacity-50"
                >
                  {submitting ? 'Verifying Cadastre & Submitting…' : 'Submit Application to Registry'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
