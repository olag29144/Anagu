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
  getListingPriceUsd,
  formatFileSize,
  formatUsd,
  formatEthFromUsd,
  NGN_PER_USD,
  type LandCategory,
  type LandDocument,
  type LandListing,
} from '@/lib/land-store';
import {
  getActiveUserAccount,
  ensureUserAccountForRegistration,
  updateUserProfile,
} from '@/lib/user-store';
import {
  captureParcelMapSnapshot,
  formatPlotEquivalents,
  type LatLngPoint,
} from '@/lib/gis-utils';
import type { OpenMapLayerId } from '@/lib/openmap-tiles';
import {
  subscribeWalletDiscovery,
  getSnapshotDetectedWallets,
  connectWalletProvider,
  getMobileWalletDeepLinksForPath,
  triggerDeviceEthereumWalletIntent,
  isMobileDevice,
  isAndroidDevice,
  mapWalletError,
  type DetectedWalletProvider,
} from '@/lib/web3-wallet';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  MapPin,
  Smartphone,
  Trash2,
  Upload,
  User,
  Wallet,
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

function parseUsdInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export default function RegisterLandPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // View & Step state
  const [viewMode, setViewMode] = useState<FormViewMode>('guided');
  const [activeStep, setActiveStep] = useState<RegistrationStep>(1);

  // Owner & Contact Details (Email & ETH Wallet are optional so anyone with a phone can register)
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerWalletAddress, setOwnerWalletAddress] = useState('');
  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletProvider[]>([]);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [showMobileWalletLinks, setShowMobileWalletLinks] = useState(false);

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
  const [priceUsdInput, setPriceUsdInput] = useState('');

  // GIS Spatial State
  const [existingParcels, setExistingParcels] = useState<LandListing[]>([]);
  const [gisLat, setGisLat] = useState<number | undefined>(undefined);
  const [gisLng, setGisLng] = useState<number | undefined>(undefined);
  const [gisPolygon, setGisPolygon] = useState<LatLngPoint[]>([]);
  const [gisPerimeterMeters, setGisPerimeterMeters] = useState<number | undefined>(undefined);
  const [gisMapImageUrl, setGisMapImageUrl] = useState<string | null>(null);
  const [gisLayerId, setGisLayerId] = useState<OpenMapLayerId>('osm');
  const [gisResetSignal, setGisResetSignal] = useState(0);

  // Uploaded documents (any file type accepted; optional if not on hand)
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredLand, setRegisteredLand] = useState<LandListing | null>(null);

  const [activeUser, setActiveUser] = useState<ReturnType<typeof getActiveUserAccount>>(null);

  useEffect(() => {
    setExistingParcels(getLandListings());
    const current = getActiveUserAccount();
    setActiveUser(current);
    if (current) {
      setOwnerName((prev) => prev || current.fullName);
      if (current.phone && current.phone !== 'Not provided') {
        setOwnerPhone((prev) => prev || current.phone);
      }
      if (current.email && current.email !== 'Not provided') {
        setOwnerEmail((prev) => prev || current.email);
      }
      if (current.walletAddress) {
        setOwnerWalletAddress((prev) => prev || current.walletAddress || '');
      }
    }
    const unsubscribe = subscribeWalletDiscovery((wallets) => {
      setDetectedWallets(wallets);
    });
    return () => {
      unsubscribe();
    };
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
    setGisMapImageUrl(payload.mapSnapshotDataUrl ?? null);
    if (payload.layerId) {
      setGisLayerId(payload.layerId);
    }

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

  const isValidEthAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const handleAutoFillWallet = async () => {
    setError(null);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const wallets =
      detectedWallets.length > 0 ? detectedWallets : getSnapshotDetectedWallets();
    if (wallets.length === 0) {
      if (isMobileDevice() && isAndroidDevice()) {
        triggerDeviceEthereumWalletIntent();
      }
      setShowMobileWalletLinks(true);
      setError(
        'No browser Web3 wallet extension detected. Open a mobile wallet below, unlock your browser extension, or paste your 0x... wallet address.',
      );
      return;
    }

    setConnectingWallet(true);
    try {
      const connected = await connectWalletProvider(wallets[0]);
      setOwnerWalletAddress(connected.address);
      setShowMobileWalletLinks(false);
      const current = getActiveUserAccount();
      if (current) {
        updateUserProfile(current.id, { walletAddress: connected.address });
      }
    } catch (err) {
      setError(mapWalletError(err));
    } finally {
      setConnectingWallet(false);
    }
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
    if (ownerWalletAddress.trim() && !isValidEthAddress(ownerWalletAddress)) {
      setError(
        'Please enter a valid 42-character ETH wallet address starting with 0x, or leave it blank.',
      );
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
    const parsedPriceUsd = forSale ? parseUsdInput(priceUsdInput) : 0;
    if (forSale && (!parsedPriceUsd || parsedPriceUsd <= 0)) {
      setError('Please enter your asking price in USD ($), or uncheck "List this land for sale".');
      return;
    }
    goToStep(4);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
    if (ownerWalletAddress.trim() && !isValidEthAddress(ownerWalletAddress)) {
      setError(
        'Please enter a valid 42-character ETH wallet address starting with 0x, or leave it blank.',
      );
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
    const parsedPriceUsd = forSale ? parseUsdInput(priceUsdInput) : 0;
    if (forSale && (!parsedPriceUsd || parsedPriceUsd <= 0)) {
      setError('Please enter an asking price in USD ($), or switch off "List this land for sale".');
      if (viewMode === 'guided') setActiveStep(3);
      return;
    }

    setSubmitting(true);

    let resolvedMapImageUrl = gisMapImageUrl;
    if (
      !resolvedMapImageUrl &&
      (gisPolygon.length >= 3 || (gisLat !== undefined && gisLng !== undefined))
    ) {
      try {
        resolvedMapImageUrl = await captureParcelMapSnapshot({
          polygon: gisPolygon,
          center:
            gisLat !== undefined && gisLng !== undefined
              ? { lat: gisLat, lng: gisLng }
              : null,
          layerId: gisLayerId,
        });
      } catch {
        resolvedMapImageUrl = null;
      }
    }

    const activeAccount = getActiveUserAccount();
    if (activeAccount && activeAccount.status === 'suspended') {
      setError('Your user account is currently suspended and cannot submit new lands.');
      setSubmitting(false);
      return;
    }

    const userAccount = ensureUserAccountForRegistration({
      fullName: ownerName.trim(),
      phone: ownerPhone.trim(),
      email: ownerEmail.trim(),
      walletAddress: ownerWalletAddress.trim() || undefined,
    });

    const created = addLandListing({
      userId: userAccount.id,
      title: title.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim() || 'Not provided',
      ownerPhone: ownerPhone.trim(),
      ownerWalletAddress: ownerWalletAddress.trim() || undefined,
      state,
      location: location.trim(),
      areaSqm: parsedArea,
      category,
      documentType,
      documentNumber: documentNumber.trim() || 'Pending Reference',
      priceUsd: parsedPriceUsd,
      priceNgn: parsedPriceUsd * NGN_PER_USD,
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
      imageUrl: resolvedMapImageUrl || undefined,
      documents,
    });

    setExistingParcels(getLandListings());
    setRegisteredLand(created);
    setSubmitting(false);
  };

  const handleReset = () => {
    setRegisteredLand(null);
    setActiveStep(1);
    setOwnerWalletAddress('');
    setTitle('');
    setLocation('');
    setAreaSqm('');
    setDocumentNumber('');
    setCoordinates('');
    setDescription('');
    setPriceUsdInput('');
    setDocuments([]);
    setGisLat(undefined);
    setGisLng(undefined);
    setGisPolygon([]);
    setGisPerimeterMeters(undefined);
    setGisMapImageUrl(null);
    setGisResetSignal((prev) => prev + 1);
    setError(null);
  };

  const step1Complete = Boolean(ownerName.trim() && ownerPhone.trim());
  const step2Complete = gisPolygon.length >= 3 || Boolean(gisLat !== undefined && gisLng !== undefined);
  const step3Complete = Boolean(
    title.trim() &&
      location.trim() &&
      Number(areaSqm) > 0 &&
      (!forSale || parseUsdInput(priceUsdInput) > 0),
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
  const numericPriceUsd = parseUsdInput(priceUsdInput);

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href={activeUser ? '/dashboard' : '/'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{activeUser ? 'Back to My Dashboard' : 'Back to Home'}</span>
            </Link>
            {!activeUser && (
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#38BDF8] hover:text-[#67E8F9] transition-colors whitespace-nowrap"
              >
                <span>Explore Land for Sale</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
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

              <div className="my-6 flex flex-col items-center gap-3">
                {registeredLand.imageUrl && (
                  <div className="w-full max-w-sm overflow-hidden rounded-[10px] border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={registeredLand.imageUrl}
                      alt={registeredLand.title}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs border-t border-[rgba(91,133,167,0.18)]">
                      <span className="text-[#94A3B8] truncate">
                        {registeredLand.location}, {registeredLand.state}
                      </span>
                      <div className="text-right shrink-0">
                        {(() => {
                          const usd = getListingPriceUsd(registeredLand);
                          return registeredLand.forSale && usd > 0 ? (
                            <>
                              <p className="font-mono font-bold text-emerald-400 tabular-nums">
                                {formatUsd(usd)}
                              </p>
                              <p className="font-mono text-[11px] text-[#38BDF8] tabular-nums">
                                {formatEthFromUsd(usd)}
                              </p>
                            </>
                          ) : (
                            <span className="font-mono text-[#94A3B8]">Registry Only</span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="inline-block rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] px-4 py-2 font-mono text-xs text-[#38BDF8]">
                  Parcel Reference: {registeredLand.parcelRef}
                </div>
                {registeredLand.forSale && getListingPriceUsd(registeredLand) > 0 && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-[#05080D] border border-emerald-500/35 px-4 py-1.5 font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    <span>Asking Price: {formatUsd(getListingPriceUsd(registeredLand))}</span>
                    <span className="text-[#475569]">·</span>
                    <span className="text-[#38BDF8]">
                      {formatEthFromUsd(getListingPriceUsd(registeredLand))}
                    </span>
                  </div>
                )}
                {registeredLand.ownerWalletAddress && (
                  <div className="inline-block rounded-lg bg-[#05080D] border border-emerald-500/30 px-4 py-1.5 font-mono text-xs text-emerald-400">
                    ETH Wallet Linked: {registeredLand.ownerWalletAddress}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors whitespace-nowrap"
                >
                  <span>Monitor in My Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {registeredLand.forSale && (
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.35)] text-sm font-medium text-[#F4F7FB] hover:border-[#38BDF8] transition-colors whitespace-nowrap"
                  >
                    <span>View on Explore Land</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-sm font-medium text-[#94A3B8] hover:text-[#F4F7FB] hover:border-[#38BDF8] whitespace-nowrap"
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

                  {/* ETH Wallet Address Field */}
                  <div className="pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label htmlFor="ownerWalletAddress" className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-[#38BDF8]" />
                        <span>ETH Wallet Address (Optional — for on-chain title &amp; Web3 payments)</span>
                      </label>
                      <button
                        type="button"
                        disabled={connectingWallet}
                        onClick={() => void handleAutoFillWallet()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#38BDF8] text-[#020305] text-[11px] font-semibold hover:bg-[#67E8F9] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {connectingWallet ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        <span>
                          {connectingWallet ? 'Connecting Wallet…' : 'Connect Wallet'}
                        </span>
                      </button>
                    </div>
                    <input
                      id="ownerWalletAddress"
                      type="text"
                      value={ownerWalletAddress}
                      onChange={(e) => setOwnerWalletAddress(e.target.value)}
                      placeholder="0x71C83812a19f20108A456789b910123456789012"
                      spellCheck={false}
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                    {ownerWalletAddress.trim() && isValidEthAddress(ownerWalletAddress) && (
                      <p className="mt-1 text-[11px] font-mono text-emerald-400">
                        Valid Ethereum (ERC-721 / Web3) wallet address
                      </p>
                    )}
                    {showMobileWalletLinks && (
                      <div className="mt-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] inline-flex items-center gap-1.5">
                            <Smartphone className="h-3.5 w-3.5 text-[#38BDF8]" />
                            <span>Open in Mobile Wallet App</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowMobileWalletLinks(false)}
                            className="text-[11px] text-[#64748B] hover:text-[#F4F7FB]"
                          >
                            Hide
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {getMobileWalletDeepLinksForPath('/register').map((wallet) => (
                            <a
                              key={wallet.id}
                              href={wallet.href}
                              className={`px-2.5 py-2 rounded-lg bg-[#0A0F16] border text-xs font-medium flex items-center justify-between gap-1.5 transition-colors ${wallet.accentClass}`}
                            >
                              <span className="truncate">{wallet.name}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
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
                        <label htmlFor="priceUsd" className="block text-xs text-[#94A3B8] mb-1.5">
                          Asking Price ($ USD) *
                        </label>
                        <input
                          id="priceUsd"
                          type="text"
                          inputMode="decimal"
                          required
                          value={priceUsdInput}
                          onChange={(e) => setPriceUsdInput(e.target.value)}
                          placeholder="e.g. 50,000"
                          className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                        {numericPriceUsd > 0 && (
                          <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-mono text-emerald-300 tabular-nums">
                            <span>Display Amount:</span>
                            <strong className="text-sm text-emerald-400">
                              {formatUsd(numericPriceUsd)}
                            </strong>
                            <span className="text-[#475569]">·</span>
                            <strong className="text-sm text-[#38BDF8]">
                              {formatEthFromUsd(numericPriceUsd)}
                            </strong>
                          </div>
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
                        {ownerWalletAddress.trim() && (
                          <p className="font-mono text-[11px] text-[#38BDF8] mt-0.5 truncate">
                            ETH: {ownerWalletAddress.trim()}
                          </p>
                        )}
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
                        <p className="text-[#64748B]">Asking Price &amp; Files</p>
                        {forSale && numericPriceUsd > 0 ? (
                          <div className="mt-0.5 font-mono tabular-nums">
                            <p className="font-semibold text-emerald-400">
                              {formatUsd(numericPriceUsd)}
                            </p>
                            <p className="text-[11px] text-[#38BDF8]">
                              ≈ {formatEthFromUsd(numericPriceUsd)}
                            </p>
                          </div>
                        ) : (
                          <p className="font-mono font-semibold text-emerald-400 mt-0.5">
                            Registry only
                          </p>
                        )}
                        <p className="text-[11px] text-[#64748B]">
                          {documents.length} {documents.length === 1 ? 'file' : 'files'} attached
                        </p>
                      </div>
                    </div>

                    {gisMapImageUrl && (
                      <div className="flex items-center gap-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gisMapImageUrl}
                          alt="Captured map preview"
                          className="h-14 w-[75px] rounded object-cover border border-[#38BDF8]/40 shrink-0"
                        />
                        <div className="text-xs min-w-0">
                          <p className="font-medium text-[#F4F7FB]">
                            Captured OpenMap Picture Attached
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            This map snapshot will display as the land photo on Explore Land.
                          </p>
                        </div>
                      </div>
                    )}
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
