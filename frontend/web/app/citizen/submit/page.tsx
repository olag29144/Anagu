'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { apiCall } from '@/lib/api';

interface SubmitApplicationResponse {
  id: string;
}

/**
 * Submit Application — Client Component.
 *
 * Land registration submission form for citizens. On success, shows the
 * issued application ID. Errors are surfaced inline.
 */
export default function SubmitApplicationPage() {
  const [fields, setFields] = useState({
    ownerName: '',
    documentNumber: '',
    documentType: '',
    issuingAuthority: '',
    parcelRef: '',
    ownerWalletAddress: '',
    parcelCoordinates: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

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
      // Reset form
      setFields({
        ownerName: '',
        documentNumber: '',
        documentType: '',
        issuingAuthority: '',
        parcelRef: '',
        ownerWalletAddress: '',
        parcelCoordinates: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (applicationId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg bg-white p-8 shadow-sm ring-1 ring-gray-200 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Application submitted</h2>
          <p className="text-sm text-gray-600">Your application has been received and is now in the pipeline.</p>
          <p className="mt-4 font-mono text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 inline-block">
            Application ID: {applicationId}
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link
              href="/citizen"
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-900"
            >
              Back to dashboard
            </Link>
            <Link
              href={`/audit/${applicationId}`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View audit trail
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <Link href="/citizen" className="text-sm text-primary-700 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Submit Application</h1>
        <p className="mt-1 text-sm text-gray-500">
          Complete all fields to register a land parcel.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Owner information */}
          <fieldset>
            <legend className="mb-4 text-sm font-semibold text-gray-900">
              Owner Information
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ownerName"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Owner name <span className="text-red-500">*</span>
                </label>
                <input
                  id="ownerName"
                  name="ownerName"
                  type="text"
                  required
                  value={fields.ownerName}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                  placeholder="Full legal name"
                />
              </div>

              <div>
                <label
                  htmlFor="ownerWalletAddress"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Wallet address <span className="text-red-500">*</span>
                </label>
                <input
                  id="ownerWalletAddress"
                  name="ownerWalletAddress"
                  type="text"
                  required
                  value={fields.ownerWalletAddress}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                  placeholder="0x..."
                />
              </div>
            </div>
          </fieldset>

          {/* Document information */}
          <fieldset>
            <legend className="mb-4 text-sm font-semibold text-gray-900">
              Title Document
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="documentNumber"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Document number <span className="text-red-500">*</span>
                </label>
                <input
                  id="documentNumber"
                  name="documentNumber"
                  type="text"
                  required
                  value={fields.documentNumber}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                  placeholder="e.g. LGA/2024/00123"
                />
              </div>

              <div>
                <label
                  htmlFor="documentType"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Document type <span className="text-red-500">*</span>
                </label>
                <select
                  id="documentType"
                  name="documentType"
                  required
                  value={fields.documentType}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                >
                  <option value="">Select type…</option>
                  <option value="Certificate of Occupancy">Certificate of Occupancy</option>
                  <option value="Right of Occupancy">Right of Occupancy</option>
                  <option value="Deed of Assignment">Deed of Assignment</option>
                  <option value="Survey Plan">Survey Plan</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="issuingAuthority"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Issuing authority <span className="text-red-500">*</span>
                </label>
                <input
                  id="issuingAuthority"
                  name="issuingAuthority"
                  type="text"
                  required
                  value={fields.issuingAuthority}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                  placeholder="e.g. Lagos State Land Bureau"
                />
              </div>
            </div>
          </fieldset>

          {/* Parcel information */}
          <fieldset>
            <legend className="mb-4 text-sm font-semibold text-gray-900">
              Parcel Information
            </legend>

            <div className="mb-4">
              <label
                htmlFor="parcelRef"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Parcel reference <span className="text-red-500">*</span>
              </label>
              <input
                id="parcelRef"
                name="parcelRef"
                type="text"
                required
                value={fields.parcelRef}
                onChange={handleChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                placeholder="e.g. LG-IKJ-2024-0001"
              />
            </div>

            <div>
              <label
                htmlFor="parcelCoordinates"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Parcel coordinates (GeoJSON polygon ring){' '}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                id="parcelCoordinates"
                name="parcelCoordinates"
                rows={5}
                required
                value={fields.parcelCoordinates}
                onChange={handleChange}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
                placeholder='[[3.3792,6.5244],[3.3800,6.5244],[3.3800,6.5250],[3.3792,6.5250],[3.3792,6.5244]]'
              />
              <p className="mt-1 text-xs text-gray-500">
                JSON array of <code>[longitude, latitude]</code> pairs (WGS 84, EPSG:4326).
                First and last point must be identical to close the polygon.
              </p>
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <Link
              href="/citizen"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center rounded-md bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:ring-offset-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Submitting…
                </>
              ) : (
                'Submit application'
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
