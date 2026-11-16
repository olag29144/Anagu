'use client';

import { useState, useRef, useEffect, useCallback, FormEvent, DragEvent } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import {
  LandGisMapper,
  type GisMeasurementPayload,
} from '@/components/gis/LandGisMapper';
import {
  addLandListing,
  getLandListings,
  formatFileSize,
  formatNaira,
  type LandCategory,
  type LandDocument,
  type LandListing,
} from '@/lib/land-store';
import { formatPlotEquivalents, type LatLngPoint } from '@/lib/gis-utils';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MapPin,
  Trash2,
  Upload,
  User,
} from 'lucide-react';

const NIGERIAN_STATES = [
  'Lagos State',
  'FCT Abuja',
  'Ogun State',
  'Rivers State',
  'Oyo State',
  'Enugu State',
  'Kano State',
  'Abia State',
  'Adamawa State',
  'Akwa Ibom State',
  'Anambra State',
  'Bauchi State',
  'Bayelsa State',
  'Benue State',
  'Borno State',
  'Cross River State',
  'Delta State',
  'Ebonyi State',
  'Edo State',
  'Ekiti State',
  'Gombe State',
  'Imo State',
  'Jigawa State',
  'Kaduna State',
  'Katsina State',
  'Kebbi State',
  'Kogi State',
  'Kwara State',
  'Nasarawa State',
  'Niger State',
  'Ondo State',
  'Osun State',
  'Plateau State',
  'Sokoto State',
  'Taraba State',
  'Yobe State',
  'Zamfara State',
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
  'Family / Purchase Receipt',
  'Letter of Allocation',
  'Customary Land Agreement',
  'Other Land Document',
];

const QUICK_SIZE_OPTIONS = [
  { label: '½ Plot', sqm: 324 },
  { label: 'Lagos Plot', sqm: 450 },
  { label: 'Standard Plot', sqm: 648 },
  { label: '2 Plots', sqm: 1296 },
  { label: '1 Acre', sqm: 4047 },
];

type RegistrationStep = 1 | 2 | 3 | 4;
type FormViewMode = 'guided' | 'all';

const STEPS: Array<{ id: RegistrationStep; label: string; shortLabel: string }> = [
  { id: 1, label: 'Your Contact', shortLabel: '1. Contact' },
  { id: 2, label: 'Map & 4 Corners', shortLabel: '2. Map' },
  { id: 3, label: 'Land Details', shortLabel: '3. Details' },
  { id: 4, label: 'Documents & Submit', shortLabel: '4. Upload' },
];

export default function RegisterLandPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // View & Step state
  const [viewMode, setViewMode] = useState<FormViewMode>('guided');
  const [activeStep, setActiveStep] = useState<RegistrationStep>(1);

  // Owner & Contact Details (Email is optional so anyone with a phone can register)
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // Land Details
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

  // GIS Spatial State
  const [existingParcels, setExistingParcels] = useState<LandListing[]>([]);
  const [gisLat, setGisLat] = useState<number | undefined>(undefined);
  const [gisLng, setGisLng] = useState<number | undefined>(undefined);
  const [gisPolygon, setGisPolygon] = useState<LatLngPoint[]>([]);
  const [gisPerimeterMeters, setGisPerimeterMeters] = useState<number | undefined>(undefined);
  const [gisResetSignal, setGisResetSignal] = useState(0);

  // Uploaded documents (any file type accepted; optional if not on hand)
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredLand, setRegisteredLand] = useState<LandListing | null>(null);

  useEffect(() => {
    setExistingParcels(getLandListings());
  }, []);

  const handleGisChange = useCallback((payload: GisMeasurementPayload) => {
    if (payload.areaSqm && payload.areaSqm > 0) {
      setAreaSqm(String(payload.areaSqm));
    }
    if (payload.coordinates) {
      setCoordinates(payload.coordinates);
    }
    setGisLat(payload.lat ?? undefined);
    setGisLng(payload.lng ?? undefined);
    setGisPolygon(payload.polygon);
    setGisPerimeterMeters(payload.perimeterMeters ?? undefined);

    if (payload.suggestedLocation) {
      setLocation(payload.suggestedLocation);
    }
    if (payload.suggestedState) {
      setState(payload.suggestedState);
    }
  }, []);

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

  const goToStep = (step: RegistrationStep) => {
    setError(null);
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextFromStep1 = () => {
    if (!ownerName.trim()) {
      setError('Please enter your full name or company name.');
      return;
    }
    if (!ownerPhone.trim()) {
      setError('Please enter a phone number so buyers or officials can reach you.');
      return;
    }
    if (ownerEmail.trim() && !ownerEmail.includes('@')) {
      setError('Please enter a valid email address or leave the email box empty.');
      return;
    }
    goToStep(2);
  };

  const handleNextFromStep3 = () => {
    if (!title.trim()) {
      setError('Please give your land a short title or name.');
      return;
    }
    if (!location.trim()) {
      setError('Please enter the land location or street address.');
      return;
    }
    const parsedArea = Number(areaSqm);
    if (!parsedArea || parsedArea <= 0) {
      setError('Please enter the land size in square meters (or tap a plot size button).');
      return;
    }
    const parsedPrice = forSale ? Number(priceNgn) : 0;
    if (forSale && (!parsedPrice || parsedPrice <= 0)) {
      setError('Please enter your asking price in Naira, or uncheck "List this land for sale".');
      return;
    }
    goToStep(4);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim()) {
      setError('Please enter your full name or company name.');
      if (viewMode === 'guided') setActiveStep(1);
      return;
    }
    if (!ownerPhone.trim()) {
      setError('Please enter a contact phone number.');
      if (viewMode === 'guided') setActiveStep(1);
      return;
    }
    if (ownerEmail.trim() && !ownerEmail.includes('@')) {
      setError('Please enter a valid email address or leave email blank.');
      if (viewMode === 'guided') setActiveStep(1);
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title or name for the land.');
      if (viewMode === 'guided') setActiveStep(3);
      return;
    }
    if (!location.trim()) {
      setError('Please enter the land location or address.');
      if (viewMode === 'guided') setActiveStep(3);
      return;
    }
    const parsedArea = Number(areaSqm);
    if (!parsedArea || parsedArea <= 0) {
      setError('Please enter a valid land size in square meters (sqm) or pick a plot preset.');
      if (viewMode === 'guided') setActiveStep(3);
      return;
    }
    const parsedPrice = forSale ? Number(priceNgn) : 0;
    if (forSale && (!parsedPrice || parsedPrice <= 0)) {
      setError('Please enter an asking price in Naira (NGN), or switch off "List this land for sale".');
      if (viewMode === 'guided') setActiveStep(3);
      return;
    }

    setSubmitting(true);

    const created = addLandListing({
      title: title.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim() || 'Not provided',
      ownerPhone: ownerPhone.trim(),
      state,
      location: location.trim(),
      areaSqm: parsedArea,
      category,
      documentType,
      documentNumber: documentNumber.trim() || 'Pending Reference',
      priceNgn: parsedPrice,
      forSale,
      saleStatus: forSale ? 'available' : 'not_for_sale',
      approvalStatus: 'pending_review',
      description:
        description.trim() ||
        `${category} land parcel located at ${location.trim()}, ${state} (${parsedArea.toLocaleString()} sqm).`,
      coordinates: coordinates.trim() || 'Location Declared',
      lat: gisLat,
      lng: gisLng,
      polygon: gisPolygon.length >= 3 ? gisPolygon : undefined,
      perimeterMeters: gisPerimeterMeters,
      documents,
    });

    setExistingParcels(getLandListings());
    setRegisteredLand(created);
    setSubmitting(false);
  };

  const handleReset = () => {
    setRegisteredLand(null);
    setActiveStep(1);
    setTitle('');
    setLocation('');
    setAreaSqm('');
    setDocumentNumber('');
    setCoordinates('');
    setDescription('');
    setPriceNgn('');
    setDocuments([]);
    setGisLat(undefined);
    setGisLng(undefined);
    setGisPolygon([]);
    setGisPerimeterMeters(undefined);
    setGisResetSignal((prev) => prev + 1);
    setError(null);
  };

  const step1Complete = Boolean(ownerName.trim() && ownerPhone.trim());
  const step2Complete = gisPolygon.length >= 3 || Boolean(gisLat !== undefined && gisLng !== undefined);
  const step3Complete = Boolean(
    title.trim() &&
      location.trim() &&
      Number(areaSqm) > 0 &&
      (!forSale || Number(priceNgn) > 0),
  );
  const step4Complete = documents.length > 0;

  const isStepDone = (stepId: RegistrationStep) => {
    if (stepId === 1) return step1Complete;
    if (stepId === 2) return step2Complete;
    if (stepId === 3) return step3Complete;
    return step4Complete;
  };

  const numericArea = Number(areaSqm);
  const areaEquivalents =
    numericArea > 0 ? formatPlotEquivalents(numericArea) : null;
  const numericPrice = Number(priceNgn);

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8] hover:text-[#67E8F9] transition-colors whitespace-nowrap"
            >
              <span>Explore Land for Sale</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F4F7FB]">
                Register Your Land
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#94A3B8] max-w-2xl">
                Simple for every landowner — follow the 4 quick steps below or switch to the full form to enter everything at once.
              </p>
            </div>

            {!registeredLand && (
              <div className="inline-flex p-1 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.24)] self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('guided')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    viewMode === 'guided'
                      ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>Step-by-Step (Easy)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    viewMode === 'all'
                      ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Full Form</span>
                </button>
              </div>
            )}
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
                Your land <strong className="text-[#F4F7FB]">{registeredLand.title}</strong>
                {registeredLand.documents.length > 0
                  ? ` with ${registeredLand.documents.length} uploaded ${registeredLand.documents.length === 1 ? 'document' : 'documents'}`
                  : ''}{' '}
                has been submitted to the registry.
              </p>

              <div className="my-6 inline-block rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] px-4 py-2 font-mono text-xs text-[#38BDF8]">
                Parcel Reference: {registeredLand.parcelRef}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {registeredLand.forSale && (
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors whitespace-nowrap"
                  >
                    <span>View on Explore Land</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-sm font-medium text-[#F4F7FB] hover:border-[#38BDF8] whitespace-nowrap"
                >
                  Register Another Land
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Clickable 4-Step Progress Bar (visible in Step-by-Step mode) */}
              {viewMode === 'guided' && (
                <nav
                  aria-label="Registration steps"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {STEPS.map((step) => {
                    const isActive = activeStep === step.id;
                    const done = isStepDone(step.id);
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => goToStep(step.id)}
                        className={`h-11 px-3 rounded-[10px] border text-left flex items-center justify-between gap-2 transition-colors ${
                          isActive
                            ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#F4F7FB]'
                            : done
                              ? 'bg-[#0A0F16] border-emerald-500/35 text-[#E2E8F0] hover:border-[#38BDF8]/50'
                              : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                        }`}
                      >
                        <span className="text-xs font-medium truncate">
                          {step.shortLabel}
                        </span>
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <span
                            className={`text-[11px] font-mono shrink-0 ${
                              isActive ? 'text-[#38BDF8]' : 'text-[#64748B]'
                            }`}
                          >
                            {step.id}/4
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              )}

              <form
                onSubmit={handleSubmit}
                noValidate
                className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-5 sm:p-8 space-y-8 shadow-xl"
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

                {/* STEP 1: Owner Contact Details */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 1 ? 'space-y-5' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        1. Owner / Seller Contact Details
                      </legend>
                    </div>
                    <span className="text-xs text-[#64748B]">Only Name &amp; Phone required</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="ownerName" className="block text-xs text-[#94A3B8] mb-1.5">
                        Full Name or Company Name *
                      </label>
                      <input
                        id="ownerName"
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g. Babatunde Adeleke"
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
                        placeholder="e.g. 0803 123 4567"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="ownerEmail" className="block text-xs text-[#94A3B8] mb-1.5">
                        Email Address (Optional)
                      </label>
                      <input
                        id="ownerEmail"
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>

                  {viewMode === 'guided' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleNextFromStep1}
                        className="h-11 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <span>Continue to Map &amp; Corners</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </fieldset>

                {/* STEP 2: Interactive GIS Map (Always mounted to preserve map state!) */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 2 ? 'space-y-4' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        2. Locate &amp; Mark Land on Map
                      </legend>
                    </div>
                    <span className="text-xs text-[#94A3B8]">
                      Optional — auto-fills Land Size &amp; Coordinates into Step 3
                    </span>
                  </div>

                  <LandGisMapper
                    existingParcels={existingParcels}
                    parcelTitle={title}
                    onGisChange={handleGisChange}
                    resetSignal={gisResetSignal}
                    isVisible={viewMode === 'all' || activeStep === 2}
                  />

                  {viewMode === 'guided' && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-sm font-medium text-[#E2E8F0] hover:border-[#38BDF8] inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="h-11 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <span>{step2Complete ? 'Continue to Land Details' : 'Skip Map / Enter Details Manually'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </fieldset>

                {/* STEP 3: Land Details & Price */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 3 ? 'space-y-5' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        3. Land Details &amp; Pricing
                      </legend>
                    </div>
                    <span className="text-xs text-[#64748B]">
                      Fields from the map are already pre-filled if you marked them
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="landTitle" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Name / Title *
                      </label>
                      <input
                        id="landTitle"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. 1 Plot of Land at Lekki Phase 1"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-xs text-[#94A3B8] mb-1.5">
                        State *
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
                      Full Address / Town / LGA *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                      <input
                        id="location"
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Off Admiralty Way, Lekki Phase 1, Eti-Osa LGA"
                        className="w-full h-11 pl-10 pr-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Category + Land Size with Plot Quick Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                    <div className="sm:col-span-4">
                      <label htmlFor="category" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Use / Category *
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

                    <div className="sm:col-span-4">
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
                        placeholder="e.g. 648"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                      {areaEquivalents && (
                        <p className="mt-1 text-[11px] font-mono text-[#38BDF8] tabular-nums">
                          ≈ {areaEquivalents.standardPlots648} standard plots · {areaEquivalents.hectares} ha
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-4">
                      <label htmlFor="coordinates" className="block text-xs text-[#94A3B8] mb-1.5">
                        GPS Coordinates (Optional)
                      </label>
                      <input
                        id="coordinates"
                        type="text"
                        value={coordinates}
                        onChange={(e) => setCoordinates(e.target.value)}
                        placeholder="Auto-filled from map"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Tap Plot Sizes */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#64748B]">Quick Size Select:</span>
                    {QUICK_SIZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setAreaSqm(String(opt.sqm))}
                        className={`px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          Number(areaSqm) === opt.sqm
                            ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#67E8F9]'
                            : 'bg-[#05080D] border-[rgba(91,133,167,0.24)] text-[#94A3B8] hover:text-[#F4F7FB]'
                        }`}
                      >
                        {opt.label} ({opt.sqm.toLocaleString()} sqm)
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="documentType" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Paper / Title Type
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
                        Document / Survey Number (Optional)
                      </label>
                      <input
                        id="documentNumber"
                        type="text"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        placeholder="Leave blank if not available yet"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-xs text-[#94A3B8] mb-1.5">
                      Description &amp; Nearby Landmarks (Optional)
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Dry land, fenced with gate, tarred road access, 5 mins from expressway..."
                      className="w-full p-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>

                  {/* Listing for Sale Option */}
                  <div className="pt-4 border-t border-[rgba(91,133,167,0.16)] space-y-4">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-[#F4F7FB]">
                          List this land for sale on Explore Land
                        </p>
                        <p className="text-xs text-[#64748B]">
                          Turn off if you only want to register your land without selling it.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={forSale}
                        onChange={(e) => setForSale(e.target.checked)}
                        className="h-5 w-5 rounded border-[rgba(148,163,184,0.3)] bg-[#05080D] text-[#38BDF8] focus:ring-[#38BDF8]/30 shrink-0"
                      />
                    </label>

                    {forSale && (
                      <div>
                        <label htmlFor="priceNgn" className="block text-xs text-[#94A3B8] mb-1.5">
                          Asking Price (₦ Naira) *
                        </label>
                        <input
                          id="priceNgn"
                          type="number"
                          min="1"
                          required
                          value={priceNgn}
                          onChange={(e) => setPriceNgn(e.target.value)}
                          placeholder="e.g. 45000000"
                          className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                        {numericPrice > 0 && (
                          <p className="mt-1 text-xs font-mono text-emerald-400 tabular-nums">
                            Listed price: {formatNaira(numericPrice)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {viewMode === 'guided' && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-sm font-medium text-[#E2E8F0] hover:border-[#38BDF8] inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Map</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFromStep3}
                        className="h-11 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <span>Continue to Upload Documents</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </fieldset>

                {/* STEP 4: Upload Land Documents (Any File Type) & Final Submit */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 4 ? 'space-y-5' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        4. Upload Land Documents &amp; Submit
                      </legend>
                    </div>
                    <span className="text-xs text-[#64748B]">
                      Recommended · Optional if not on hand right now
                    </span>
                  </div>

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
                      Tap to choose files or take a photo of your land papers
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      All file types supported: Phone photos (JPG, PNG), PDF, Word, Survey CAD (DWG), GeoJSON, or ZIP
                    </p>
                  </div>

                  {documents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-mono text-[#94A3B8]">
                        Attached Files ({documents.length})
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

                  {/* Quick Review Before Submission */}
                  <div className="pt-4 border-t border-[rgba(91,133,167,0.16)] space-y-3">
                    <p className="text-xs font-medium text-[#94A3B8]">Registration Summary</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-[#64748B]">Owner &amp; Phone</p>
                        <p className="font-medium text-[#F4F7FB] mt-0.5 truncate">
                          {ownerName.trim() || '—'} · {ownerPhone.trim() || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Land &amp; Location</p>
                        <p className="font-medium text-[#F4F7FB] mt-0.5 truncate">
                          {title.trim() || 'Untitled'} · {state}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Size &amp; Map</p>
                        <p className="font-mono font-medium text-[#F4F7FB] mt-0.5 tabular-nums">
                          {numericArea > 0 ? `${numericArea.toLocaleString()} sqm` : '—'} ·{' '}
                          {gisPolygon.length >= 3 ? `${gisPolygon.length} corners` : 'No map box'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Listing &amp; Files</p>
                        <p className="font-mono font-medium text-[#F4F7FB] mt-0.5 tabular-nums">
                          {forSale && numericPrice > 0 ? formatNaira(numericPrice) : 'Registry only'} ·{' '}
                          {documents.length} {documents.length === 1 ? 'file' : 'files'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    {viewMode === 'guided' && (
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="h-12 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-sm font-medium text-[#E2E8F0] hover:border-[#38BDF8] inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 h-12 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Check className="h-4 w-4" />
                      <span>{submitting ? 'Submitting Land Registration…' : 'Submit Land Registration'}</span>
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
