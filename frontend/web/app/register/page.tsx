'use client';

import { useState, useRef, FormEvent, DragEvent } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import {
  addLandListing,
  formatFileSize,
  type LandCategory,
  type LandDocument,
  type LandListing,
} from '@/lib/land-store';
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react';

const NIGERIAN_STATES = [
  'Lagos State',
  'FCT Abuja',
  'Ogun State',
  'Rivers State',
  'Oyo State',
  'Enugu State',
  'Kano State',
  'Kaduna State',
  'Delta State',
  'Edo State',
  'Akwa Ibom State',
  'Anambra State',
  'Imo State',
  'Plateau State',
  'Cross River State',
  'Ondo State',
  'Other State',
];

const LAND_CATEGORIES: LandCategory[] = [
  'Residential',
  'Commercial',
  'Agricultural',
  'Industrial',
  'Mixed-Use',
];

const DOCUMENT_TYPES = [
  'Certificate of Occupancy (C of O)',
  "Governor's Consent",
  'Deed of Assignment',
  'Right of Occupancy (R of O)',
  'Registered Survey Plan',
  'Excision / Gazette',
  'Other Land Document',
];

export default function RegisterLandPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Owner & Land Details
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const [title, setTitle] = useState('');
  const [state, setState] = useState('Lagos State');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<LandCategory>('Residential');
  const [areaSqm, setAreaSqm] = useState('');
  const [documentType, setDocumentType] = useState('Certificate of Occupancy (C of O)');
  const [documentNumber, setDocumentNumber] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [description, setDescription] = useState('');

  const [forSale, setForSale] = useState(true);
  const [priceNgn, setPriceNgn] = useState('');

  // Uploaded documents (any file type accepted)
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredLand, setRegisteredLand] = useState<LandListing | null>(null);

  const readFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newDocs: LandDocument[] = await Promise.all(
      Array.from(fileList).map(
        (file) =>
          new Promise<LandDocument>((resolve) => {
            const docBase: LandDocument = {
              id: `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              uploadedAt: new Date().toISOString(),
            };

            // Store inline preview/download URL for files up to 500 KB
            if (file.size <= 500 * 1024) {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  ...docBase,
                  dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
                });
              };
              reader.onerror = () => resolve(docBase);
              reader.readAsDataURL(file);
            } else {
              resolve(docBase);
            }
          }),
      ),
    );

    setDocuments((prev) => [...prev, ...newDocs]);
    setError(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    void readFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim()) {
      setError('Please enter your full name or company name.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!ownerPhone.trim()) {
      setError('Please enter a contact phone number.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title or name for the land parcel.');
      return;
    }
    if (!location.trim()) {
      setError('Please enter the full land location or address.');
      return;
    }
    const parsedArea = Number(areaSqm);
    if (!parsedArea || parsedArea <= 0) {
      setError('Please enter a valid land size in square meters (sqm).');
      return;
    }
    if (!documentNumber.trim()) {
      setError('Please enter the document or survey plan reference number.');
      return;
    }
    const parsedPrice = forSale ? Number(priceNgn) : 0;
    if (forSale && (!parsedPrice || parsedPrice <= 0)) {
      setError('Please enter an asking price in Naira (NGN) for listing on Explore Land.');
      return;
    }
    if (documents.length === 0) {
      setError('Please upload at least one land document (any file format is supported).');
      return;
    }

    setSubmitting(true);

    const created = addLandListing({
      title: title.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerPhone: ownerPhone.trim(),
      state,
      location: location.trim(),
      areaSqm: parsedArea,
      category,
      documentType,
      documentNumber: documentNumber.trim(),
      priceNgn: parsedPrice,
      forSale,
      saleStatus: forSale ? 'available' : 'not_for_sale',
      approvalStatus: 'pending_review',
      description:
        description.trim() ||
        `${category} land parcel located at ${location.trim()}, ${state} (${parsedArea.toLocaleString()} sqm).`,
      coordinates: coordinates.trim() || 'Surveyed Boundary',
      documents,
    });

    setRegisteredLand(created);
    setSubmitting(false);
  };

  const handleReset = () => {
    setRegisteredLand(null);
    setTitle('');
    setLocation('');
    setAreaSqm('');
    setDocumentNumber('');
    setCoordinates('');
    setDescription('');
    setPriceNgn('');
    setDocuments([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#38BDF8] hover:text-[#67E8F9] transition-colors"
            >
              <span>Explore Land for Sale</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mb-8">
            <p className="text-xs font-mono uppercase tracking-wider text-[#38BDF8] mb-2">
              Land Registration &amp; Document Submission
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F4F7FB]">
              Register Land
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[#94A3B8]">
              Enter your details, parcel information, and upload your land documents (PDF, images,
              CAD plans, or any supporting file).
            </p>
          </div>

          {registeredLand ? (
            <div className="rounded-[12px] bg-[#0A0F16] border border-emerald-500/40 p-8 text-center shadow-xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-[#F4F7FB]">
                Land Registered Successfully
              </h2>
              <p className="mt-2 text-sm text-[#94A3B8] max-w-md mx-auto">
                Your parcel <strong className="text-[#F4F7FB]">{registeredLand.title}</strong> and{' '}
                {registeredLand.documents.length} uploaded{' '}
                {registeredLand.documents.length === 1 ? 'document' : 'documents'} have been submitted
                to the registry.
              </p>

              <div className="my-6 inline-block rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] px-4 py-2 font-mono text-xs text-[#38BDF8]">
                Parcel Reference: {registeredLand.parcelRef}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {registeredLand.forSale && (
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors"
                  >
                    <span>View on Explore Land</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-sm font-medium text-[#F4F7FB] hover:border-[#38BDF8]"
                >
                  Register Another Land
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-6 sm:p-8 space-y-8 shadow-xl"
            >
              {error && (
                <div
                  role="alert"
                  className="rounded-[8px] bg-rose-950/30 border border-rose-500/40 px-4 py-3 text-xs text-rose-300 flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Your Details */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-mono uppercase tracking-wider text-[#38BDF8] pb-2 border-b border-[rgba(91,133,167,0.16)] w-full">
                  01. Your Details
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="ownerName" className="block text-xs text-[#94A3B8] mb-1.5">
                      Full Name / Organization *
                    </label>
                    <input
                      id="ownerName"
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Chief Babatunde Adeleke"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ownerEmail" className="block text-xs text-[#94A3B8] mb-1.5">
                      Email Address *
                    </label>
                    <input
                      id="ownerEmail"
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@domain.com"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ownerPhone" className="block text-xs text-[#94A3B8] mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      id="ownerPhone"
                      type="tel"
                      required
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section 2: Land Details */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-mono uppercase tracking-wider text-[#38BDF8] pb-2 border-b border-[rgba(91,133,167,0.16)] w-full">
                  02. Land Details
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="landTitle" className="block text-xs text-[#94A3B8] mb-1.5">
                      Land Title / Parcel Name *
                    </label>
                    <input
                      id="landTitle"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Plot 18 Lekki Foreshore Estate"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-xs text-[#94A3B8] mb-1.5">
                      State / Jurisdiction *
                    </label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    >
                      {NIGERIAN_STATES.map((st) => (
                        <option key={st} value={st} className="bg-[#0A0F16]">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="location" className="block text-xs text-[#94A3B8] mb-1.5">
                    Full Land Location / LGA Address *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                    <input
                      id="location"
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Street, District / Layout, Local Government Area"
                      className="w-full h-11 pl-10 pr-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-xs text-[#94A3B8] mb-1.5">
                      Land Category *
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as LandCategory)}
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    >
                      {LAND_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#0A0F16]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="areaSqm" className="block text-xs text-[#94A3B8] mb-1.5">
                      Land Size (sqm) *
                    </label>
                    <input
                      id="areaSqm"
                      type="number"
                      min="1"
                      required
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(e.target.value)}
                      placeholder="e.g. 900"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="coordinates" className="block text-xs text-[#94A3B8] mb-1.5">
                      GPS / Coordinates (Optional)
                    </label>
                    <input
                      id="coordinates"
                      type="text"
                      value={coordinates}
                      onChange={(e) => setCoordinates(e.target.value)}
                      placeholder="e.g. 6.4421° N, 3.5284° E"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="documentType" className="block text-xs text-[#94A3B8] mb-1.5">
                      Title Document Type *
                    </label>
                    <select
                      id="documentType"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    >
                      {DOCUMENT_TYPES.map((dt) => (
                        <option key={dt} value={dt} className="bg-[#0A0F16]">
                          {dt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="documentNumber" className="block text-xs text-[#94A3B8] mb-1.5">
                      Document / Survey Number *
                    </label>
                    <input
                      id="documentNumber"
                      type="text"
                      required
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="e.g. LASG/LUAC/2026/0412"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-xs text-[#94A3B8] mb-1.5">
                    Land Description &amp; Features (Optional)
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe terrain, road access, perimeter fencing, landmarks, or encumbrance status..."
                    className="w-full p-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>

                {/* Listing for Sale Option */}
                <div className="rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.20)] p-4 space-y-4">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-[#F4F7FB]">
                        List this land for sale on Explore Land
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Make your land parcel visible to buyers browsing the Explore Land marketplace.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={forSale}
                      onChange={(e) => setForSale(e.target.checked)}
                      className="h-5 w-5 rounded border-[rgba(148,163,184,0.3)] bg-[#0A0F16] text-[#38BDF8] focus:ring-[#38BDF8]/30"
                    />
                  </label>

                  {forSale && (
                    <div>
                      <label htmlFor="priceNgn" className="block text-xs text-[#94A3B8] mb-1.5">
                        Asking Price (₦ NGN) *
                      </label>
                      <input
                        id="priceNgn"
                        type="number"
                        min="1"
                        required
                        value={priceNgn}
                        onChange={(e) => setPriceNgn(e.target.value)}
                        placeholder="e.g. 85000000"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#0A0F16] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Section 3: Upload Land Documents (Any File Type) */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-mono uppercase tracking-wider text-[#38BDF8] pb-2 border-b border-[rgba(91,133,167,0.16)] w-full">
                  03. Upload Land Documents (Any File Type)
                </legend>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`rounded-[10px] border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-[#38BDF8] bg-[#38BDF8]/10'
                      : 'border-[rgba(91,133,167,0.30)] bg-[#05080D] hover:border-[#38BDF8]/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void readFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <Upload className="mx-auto h-8 w-8 text-[#38BDF8] mb-3" />
                  <p className="text-sm font-medium text-[#F4F7FB]">
                    Click to upload or drag and drop land documents
                  </p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    All file formats accepted: PDF, JPG, PNG, DOCX, DWG, GeoJSON, ZIP, or scanned deeds
                  </p>
                </div>

                {documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-[#94A3B8]">
                      Uploaded Files ({documents.length})
                    </p>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.20)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {doc.type.startsWith('image/') && doc.dataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={doc.dataUrl}
                              alt={doc.name}
                              className="h-10 w-10 rounded object-cover border border-[rgba(91,133,167,0.25)] shrink-0"
                            />
                          ) : doc.type.startsWith('image/') ? (
                            <ImageIcon className="h-5 w-5 text-[#38BDF8] shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-[#38BDF8] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#F4F7FB] truncate">
                              {doc.name}
                            </p>
                            <p className="text-xs font-mono text-[#64748B]">
                              {formatFileSize(doc.size)} · {doc.type || 'file'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          className="p-2 rounded-lg text-[#64748B] hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                          aria-label={`Remove ${doc.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{submitting ? 'Submitting Land Registration…' : 'Submit Land Registration'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
