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
  updateLandListing,
  getListingPriceUsd,
  getListingPriceToken,
  tokenToUsd,
  formatFileSize,
  formatUsd,
  formatTokenAmount,
  formatListingTokenPrice,
  NGN_PER_USD,
  type LandCategory,
  type LandDocument,
  type LandListing,
} from '@/lib/land-store';
import { useIntegratedToken } from '@/lib/use-integrated-token';
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
import { WalletConnectModal } from '@/components/web3/WalletConnectModal';
import {
  subscribeWalletDiscovery,
  discoverAllWallets,
  connectWalletProvider,
  triggerDeviceEthereumWalletIntent,
  isMobileDevice,
  isAndroidDevice,
  mapWalletError,
  type DetectedWalletProvider,
  type ConnectedWalletState,
} from '@/lib/web3-wallet';
import {
  registerTitleOnChain,
  formatContractError,
} from '@/lib/ethers-contracts';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  MapPin,
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
  'Registered Survey Plan',
  'Certificate of Occupancy (C of O)',
  "Governor's Consent",
  'Deed of Assignment',
  'Right of Occupancy (R of O)',
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

type RegistrationStep = 1 | 2;
type FormViewMode = 'guided' | 'all';

function parseTokenInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function buildShortTitleFromLocation(rawAddress: string): string {
  const firstSegment = rawAddress.split(',')[0]?.trim();
  if (!firstSegment) return '';
  return `Land at ${firstSegment}`.slice(0, 80);
}

export default function RegisterLandPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);

  // Simple 2-step flow (Step 1: Find Address & Draw on Map, Step 2: Details & Submit)
  const [viewMode, setViewMode] = useState<FormViewMode>('guided');
  const [activeStep, setActiveStep] = useState<RegistrationStep>(1);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [editingOwnerInline, setEditingOwnerInline] = useState(false);

  // Owner & Contact Details (auto-filled when signed in)
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerWalletAddress, setOwnerWalletAddress] = useState('');
  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletProvider[]>([]);
  const [connectedProvider, setConnectedProvider] = useState<DetectedWalletProvider | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletState | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalError, setWalletModalError] = useState<string | null>(null);
  const [mintingOnChain, setMintingOnChain] = useState(false);
  const [onChainMintError, setOnChainMintError] = useState<string | null>(null);

  // Essential Land Details (location, state, areaSqm, title auto-filled from map when searched/drawn)
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [state, setState] = useState('Lagos State');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<LandCategory>('Residential');
  const [areaSqm, setAreaSqm] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [description, setDescription] = useState('');

  const { tokenInfo } = useIntegratedToken(connectedProvider?.provider ?? null);
  const [forSale, setForSale] = useState(true);
  const [priceTokenInput, setPriceTokenInput] = useState('');

  // GIS Spatial State
  const [existingParcels, setExistingParcels] = useState<LandListing[]>([]);
  const [gisLat, setGisLat] = useState<number | undefined>(undefined);
  const [gisLng, setGisLng] = useState<number | undefined>(undefined);
  const [gisPolygon, setGisPolygon] = useState<LatLngPoint[]>([]);
  const [gisPerimeterMeters, setGisPerimeterMeters] = useState<number | undefined>(undefined);
  const [gisMapImageUrl, setGisMapImageUrl] = useState<string | null>(null);
  const [gisLayerId, setGisLayerId] = useState<OpenMapLayerId>('hybrid');
  const [gisResetSignal, setGisResetSignal] = useState(0);

  // Required land documents / photos
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Submission state
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

  useEffect(() => {
    if (error) {
      errorAlertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  const titleManuallyEditedRef = useRef(titleManuallyEdited);
  titleManuallyEditedRef.current = titleManuallyEdited;

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
      if (!titleManuallyEditedRef.current) {
        const suggested = buildShortTitleFromLocation(payload.suggestedLocation);
        if (suggested) setTitle(suggested);
      }
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

  const connectSelectedWallet = async (wallet: DetectedWalletProvider) => {
    setConnectingWallet(true);
    setWalletModalError(null);
    setError(null);
    try {
      const connected = await connectWalletProvider(wallet);
      setConnectedProvider(wallet);
      setConnectedWallet(connected);
      setOwnerWalletAddress(connected.address);
      setShowWalletModal(false);
      const current = getActiveUserAccount();
      if (current) {
        updateUserProfile(current.id, { walletAddress: connected.address });
      }
      return connected;
    } catch (err) {
      const msg = mapWalletError(err);
      setWalletModalError(msg);
      setError(msg);
      return null;
    } finally {
      setConnectingWallet(false);
    }
  };

  const handleAutoFillWallet = async () => {
    setError(null);
    setWalletModalError(null);
    const wallets = await discoverAllWallets(350);
    setDetectedWallets(wallets);

    if (wallets.length === 1) {
      await connectSelectedWallet(wallets[0]);
      return;
    }

    if (wallets.length === 0 && isMobileDevice() && isAndroidDevice()) {
      triggerDeviceEthereumWalletIntent();
    }
    setShowWalletModal(true);
  };

  const handleRegisterOnChain = async () => {
    if (!registeredLand) return;
    setOnChainMintError(null);
    const wallets = await discoverAllWallets(350);
    setDetectedWallets(wallets);
    const walletToUse = connectedProvider ?? wallets[0];

    if (!walletToUse) {
      setShowWalletModal(true);
      setOnChainMintError(
        'No Web3 wallet detected. Connect a browser wallet or mobile wallet app to mint on LandRegistry.',
      );
      return;
    }

    setMintingOnChain(true);
    try {
      const connected = await connectWalletProvider(walletToUse);
      setConnectedProvider(walletToUse);
      setConnectedWallet(connected);
      const targetOwner =
        registeredLand.ownerWalletAddress &&
        /^0x[a-fA-F0-9]{40}$/.test(registeredLand.ownerWalletAddress)
          ? registeredLand.ownerWalletAddress
          : connected.address;

      const result = await registerTitleOnChain(walletToUse.provider, {
        applicationRef: registeredLand.id,
        ownerAddress: targetOwner,
        parcelRef: registeredLand.parcelRef,
        coordinates: registeredLand.coordinates,
        polygon: registeredLand.polygon,
        metadataUri: `anagu://title/${registeredLand.parcelRef}`,
      });

      const updatedList = updateLandListing(registeredLand.id, {
        ownerWalletAddress: targetOwner,
        onChainTokenId: result.tokenId,
        onChainTxHash: result.txHash,
        onChainParcelId: result.parcelIdBytes32,
        onChainApplicationId: result.applicationIdBytes32,
      });
      const updatedItem = updatedList.find((l) => l.id === registeredLand.id) ?? null;
      if (updatedItem) {
        setRegisteredLand(updatedItem);
      }
      setExistingParcels(updatedList);
    } catch (err) {
      setOnChainMintError(formatContractError(err));
    } finally {
      setMintingOnChain(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!location.trim()) {
      setError('Please enter the land address or search for it on the map.');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    const resolvedTitle = title.trim() || buildShortTitleFromLocation(location);
    if (!resolvedTitle) {
      setError('Please enter a short name or title for this land.');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    const parsedArea = Number(areaSqm);
    if (!parsedArea || parsedArea <= 0) {
      setError('Please draw the land on the map or pick a plot size (sqm).');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    const parsedPriceToken = forSale ? parseTokenInput(priceTokenInput) : 0;
    if (forSale && (!parsedPriceToken || parsedPriceToken <= 0)) {
      setError(
        `Please enter your asking price in ${tokenInfo.symbol} tokens, or uncheck "List this land for sale".`,
      );
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    if (!documentType.trim()) {
      setError('Please select the land paper / title type.');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    if (documents.length === 0) {
      setError('Please upload at least one land document or photo.');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    if (!ownerName.trim()) {
      setError('Please enter your full name.');
      setEditingOwnerInline(true);
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }
    if (!ownerPhone.trim()) {
      setError('Please enter a contact phone number.');
      setEditingOwnerInline(true);
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setError('Please enter a valid email address.');
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }
    if (ownerWalletAddress.trim() && !isValidEthAddress(ownerWalletAddress)) {
      setError('Please enter a valid 42-character 0x LFEE wallet address, or leave it blank.');
      setShowOptionalDetails(true);
      if (viewMode === 'guided') setActiveStep(2);
      return;
    }

    const parsedPriceUsd = forSale ? tokenToUsd(parsedPriceToken) : 0;
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
      title: resolvedTitle,
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerPhone: ownerPhone.trim(),
      ownerWalletAddress: ownerWalletAddress.trim() || undefined,
      state,
      location: location.trim(),
      areaSqm: parsedArea,
      category,
      documentType,
      documentNumber: documentNumber.trim() || 'Pending Reference',
      priceUsd: parsedPriceUsd,
      priceToken: parsedPriceToken,
      tokenSymbol: tokenInfo.symbol,
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
    setTitle('');
    setTitleManuallyEdited(false);
    setLocation('');
    setAreaSqm('');
    setDocumentType('');
    setDocumentNumber('');
    setCoordinates('');
    setDescription('');
    setPriceTokenInput('');
    setDocuments([]);
    setGisLat(undefined);
    setGisLng(undefined);
    setGisPolygon([]);
    setGisPerimeterMeters(undefined);
    setGisMapImageUrl(null);
    setGisResetSignal((prev) => prev + 1);
    setError(null);
  };

  const mapLocatedOrDrawn =
    gisPolygon.length >= 3 || Boolean(gisLat !== undefined && gisLng !== undefined);
  const detailsComplete = Boolean(
    location.trim() &&
      Number(areaSqm) > 0 &&
      documentType.trim() &&
      documents.length > 0 &&
      ownerName.trim() &&
      ownerPhone.trim() &&
      ownerEmail.trim().includes('@') &&
      (!forSale || parseTokenInput(priceTokenInput) > 0),
  );
  const hasSignedInContact = Boolean(ownerName.trim() && ownerPhone.trim());

  const numericArea = Number(areaSqm);
  const areaEquivalents = numericArea > 0 ? formatPlotEquivalents(numericArea) : null;
  const numericPriceToken = parseTokenInput(priceTokenInput);
  const numericPriceUsd = tokenToUsd(numericPriceToken);

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
                Search your land&apos;s address, draw its boundary directly on the GIS map, and set your price — most fields fill automatically.
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
                  <span>2-Step Easy</span>
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
                  <span>All on 1 Page</span>
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
                          const tokenAmt = getListingPriceToken(registeredLand);
                          const usd = getListingPriceUsd(registeredLand);
                          return registeredLand.forSale && tokenAmt > 0 ? (
                            <>
                              <p className="font-mono font-bold text-[#67E8F9] tabular-nums">
                                {formatListingTokenPrice(registeredLand, tokenInfo.symbol)}
                              </p>
                              <p className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                                ≈ {formatUsd(usd)}
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
                {registeredLand.forSale && getListingPriceToken(registeredLand) > 0 && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-lg bg-[#05080D] border border-emerald-500/35 px-4 py-1.5 font-mono text-sm font-bold text-[#67E8F9] tabular-nums">
                    <span>
                      Asking Price:{' '}
                      {formatListingTokenPrice(registeredLand, tokenInfo.symbol)}
                    </span>
                    <span className="text-[#475569]">·</span>
                    <span className="text-[#94A3B8]">
                      ≈ {formatUsd(getListingPriceUsd(registeredLand))}
                    </span>
                  </div>
                )}
                {registeredLand.ownerWalletAddress && (
                  <div className="inline-block rounded-lg bg-[#05080D] border border-emerald-500/30 px-4 py-1.5 font-mono text-xs text-emerald-400">
                    {tokenInfo.symbol} Wallet Linked: {registeredLand.ownerWalletAddress}
                  </div>
                )}
                {registeredLand.onChainTxHash ? (
                  <div className="w-full max-w-md rounded-lg bg-[#05080D] border border-emerald-500/40 p-3.5 text-left font-mono text-xs space-y-1">
                    <p className="text-emerald-400 font-semibold">
                      On-Chain Deed Minted via LandRegistry (Token #{registeredLand.onChainTokenId})
                    </p>
                    <p className="text-[#94A3B8] break-all">
                      Tx Hash: <span className="text-[#67E8F9]">{registeredLand.onChainTxHash}</span>
                    </p>
                  </div>
                ) : (
                  <div className="w-full max-w-md space-y-2">
                    {onChainMintError && (
                      <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/35 rounded-lg px-3 py-2 text-left">
                        {onChainMintError}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={mintingOnChain}
                      onClick={() => void handleRegisterOnChain()}
                      className="w-full h-10 px-4 rounded-[8px] bg-[#05080D] border border-[#38BDF8]/45 text-[#67E8F9] hover:bg-[#38BDF8]/10 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {mintingOnChain ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wallet className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {mintingOnChain
                          ? 'Approving Fee & Registering on LandRegistry…'
                          : 'Record & Mint On-Chain via LandRegistry (ethers.js)'}
                      </span>
                    </button>
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
              {/* Clickable 2-Step Bar */}
              {viewMode === 'guided' && (
                <nav
                  aria-label="Registration steps"
                  className="grid grid-cols-2 gap-2.5"
                >
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className={`h-11 px-4 rounded-[10px] border text-left flex items-center justify-between gap-2 transition-colors ${
                      activeStep === 1
                        ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#F4F7FB]'
                        : mapLocatedOrDrawn
                          ? 'bg-[#0A0F16] border-emerald-500/35 text-[#E2E8F0] hover:border-[#38BDF8]/50'
                          : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-medium truncate">
                      1. Find Address &amp; Draw Land
                    </span>
                    {mapLocatedOrDrawn ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[11px] font-mono text-[#38BDF8] shrink-0">1/2</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className={`h-11 px-4 rounded-[10px] border text-left flex items-center justify-between gap-2 transition-colors ${
                      activeStep === 2
                        ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#F4F7FB]'
                        : detailsComplete
                          ? 'bg-[#0A0F16] border-emerald-500/35 text-[#E2E8F0] hover:border-[#38BDF8]/50'
                          : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-medium truncate">
                      2. Confirm Details, Price &amp; Submit
                    </span>
                    {detailsComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[11px] font-mono text-[#64748B] shrink-0">2/2</span>
                    )}
                  </button>
                </nav>
              )}

              <form
                onSubmit={handleSubmit}
                noValidate
                className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-5 sm:p-8 space-y-8 shadow-xl"
              >
                {error && (
                  <div
                    ref={errorAlertRef}
                    role="alert"
                    className="rounded-[8px] bg-rose-950/30 border border-rose-500/40 px-4 py-3 text-xs text-rose-300 flex items-start gap-2.5"
                  >
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* STEP 1: Search Address & Draw Land on GIS Map */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 1 ? 'space-y-4' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        1. Search Address &amp; Draw Land on Map
                      </legend>
                    </div>
                    <span className="text-xs text-[#94A3B8]">
                      Auto-fills Address, State, Size &amp; Map Photo
                    </span>
                  </div>

                  <LandGisMapper
                    existingParcels={existingParcels}
                    parcelTitle={title}
                    onGisChange={handleGisChange}
                    resetSignal={gisResetSignal}
                    isVisible={viewMode === 'all' || activeStep === 1}
                  />

                  {viewMode === 'guided' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="h-11 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <span>
                          {mapLocatedOrDrawn
                            ? 'Continue to Title & Price'
                            : 'Skip Map & Enter Details'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </fieldset>

                {/* STEP 2: Essential Details & Publish */}
                <fieldset
                  className={
                    viewMode === 'all' || activeStep === 2 ? 'space-y-5' : 'hidden'
                  }
                >
                  <div className="pb-3 border-b border-[rgba(91,133,167,0.16)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#38BDF8]" />
                      <legend className="text-base font-semibold text-[#F4F7FB]">
                        2. Land Title, Size &amp; Asking Price
                      </legend>
                    </div>
                    <span className="text-xs text-[#64748B]">
                      Fields from the map are pre-filled
                    </span>
                  </div>

                  {/* Owner Contact: Name, Phone, Required Email */}
                  {hasSignedInContact && !editingOwnerInline ? (
                    <div className="space-y-4 pb-4 border-b border-[rgba(91,133,167,0.14)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 text-[#94A3B8]">
                          <User className="h-3.5 w-3.5 text-[#38BDF8] shrink-0" />
                          <span>
                            Registering as{' '}
                            <strong className="text-[#F4F7FB]">{ownerName}</strong> ·{' '}
                            <span className="font-mono text-[#E2E8F0]">{ownerPhone}</span>
                            {ownerWalletAddress.trim() && (
                              <>
                                {' '}
                                ·{' '}
                                <span className="font-mono text-[#38BDF8]">
                                  {ownerWalletAddress.slice(0, 6)}…{ownerWalletAddress.slice(-4)}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingOwnerInline(true)}
                          className="text-xs text-[#38BDF8] hover:underline whitespace-nowrap"
                        >
                          Change Contact
                        </button>
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
                          placeholder="name@example.com"
                          className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-[rgba(91,133,167,0.14)]">
                      <div>
                        <label htmlFor="ownerName" className="block text-xs text-[#94A3B8] mb-1.5">
                          Your Full Name or Company *
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
                          Email Address *
                        </label>
                        <input
                          id="ownerEmail"
                          type="email"
                          required
                          value={ownerEmail}
                          onChange={(e) => setOwnerEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Essential Land Inputs: Address, State, Land Title */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="location" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Address / Neighborhood *
                      </label>
                      <input
                        id="location"
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Auto-filled from map, or type street / LGA"
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    <div>
                      <label htmlFor="landTitle" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Name / Title *
                      </label>
                      <input
                        id="landTitle"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => {
                          setTitleManuallyEdited(true);
                          setTitle(e.target.value);
                        }}
                        placeholder="e.g. Plot at Lekki Phase 1"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="category" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Use *
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
                        placeholder="Measured from map"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                      {areaEquivalents && (
                        <p className="mt-1 text-[11px] font-mono text-[#38BDF8] tabular-nums">
                          ≈ {areaEquivalents.standardPlots648} plots · {areaEquivalents.hectares} ha
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Plot Size Tap Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#64748B]">Quick Size:</span>
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

                  {/* Required Land Paper / Title Type & Document Upload */}
                  <div className="pt-4 border-t border-[rgba(91,133,167,0.16)] space-y-4">
                    <div>
                      <label htmlFor="documentType" className="block text-xs text-[#94A3B8] mb-1.5">
                        Land Paper / Title Type *
                      </label>
                      <select
                        id="documentType"
                        required
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                      >
                        <option value="" disabled className="bg-[#0A0F16]">
                          Select land paper / title type…
                        </option>
                        {DOCUMENT_TYPES.map((dt) => (
                          <option key={dt} value={dt} className="bg-[#0A0F16]">
                            {dt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs text-[#94A3B8]">
                          Land Documents / Photos *
                        </span>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {documents.length > 0
                            ? `${documents.length} file${documents.length === 1 ? '' : 's'} attached`
                            : 'At least 1 required'}
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
                        className={`rounded-[10px] border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                          dragActive
                            ? 'border-[#38BDF8] bg-[#38BDF8]/10'
                            : documents.length > 0
                              ? 'border-emerald-500/45 bg-[#05080D] hover:border-[#38BDF8]/60'
                              : 'border-[rgba(91,133,167,0.34)] bg-[#05080D] hover:border-[#38BDF8]/60'
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
                        <Upload className="mx-auto h-6 w-6 text-[#38BDF8] mb-2" />
                        <p className="text-xs font-medium text-[#F4F7FB]">
                          Tap or drag land documents / photos here *
                        </p>
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          Required: Upload survey plan, C of O, receipt, or site photo (JPG, PNG, PDF, Word, CAD, or ZIP)
                        </p>
                      </div>

                      {documents.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.20)]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {doc.type.startsWith('image/') && doc.dataUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={doc.dataUrl}
                                    alt={doc.name}
                                    className="h-9 w-9 rounded object-cover border border-[rgba(91,133,167,0.25)] shrink-0"
                                  />
                                ) : doc.type.startsWith('image/') ? (
                                  <ImageIcon className="h-4 w-4 text-[#38BDF8] shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-[#38BDF8] shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#F4F7FB] truncate">
                                    {doc.name}
                                  </p>
                                  <p className="text-[11px] font-mono text-[#64748B]">
                                    {formatFileSize(doc.size)}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeDocument(doc.id)}
                                className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-400 transition-colors shrink-0"
                                aria-label={`Remove ${doc.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Asking Price & List for Sale */}
                  <div className="pt-4 border-t border-[rgba(91,133,167,0.16)] space-y-4">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-[#F4F7FB]">
                          List this land for sale on Explore Land
                        </p>
                        <p className="text-xs text-[#64748B]">
                          Turn off if you only want to register ownership without selling.
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
                        <label htmlFor="priceToken" className="block text-xs text-[#94A3B8] mb-1.5">
                          Asking Price ({tokenInfo.symbol} Token) *
                        </label>
                        <input
                          id="priceToken"
                          type="text"
                          inputMode="decimal"
                          required
                          value={priceTokenInput}
                          onChange={(e) => setPriceTokenInput(e.target.value)}
                          placeholder="e.g. 500"
                          className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                        {numericPriceToken > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-[#94A3B8] tabular-nums">
                            <span>Listed price:</span>
                            <strong className="text-[#67E8F9]">
                              {formatTokenAmount(numericPriceToken, tokenInfo.symbol)}
                            </strong>
                            <span className="text-[#475569]">·</span>
                            <strong className="text-emerald-400">
                              ≈ {formatUsd(numericPriceUsd)}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Optional Extras Accordion (Document Number, Description, Wallet) */}
                  <div className="pt-3 border-t border-[rgba(91,133,167,0.16)]">
                    <button
                      type="button"
                      onClick={() => setShowOptionalDetails((prev) => !prev)}
                      className="w-full py-2 flex items-center justify-between gap-2 text-xs font-medium text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
                    >
                      <span>
                        Optional: Document Number, Description or {tokenInfo.symbol} Wallet
                      </span>
                      {showOptionalDetails ? (
                        <ChevronUp className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      )}
                    </button>

                    {showOptionalDetails && (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="documentNumber" className="block text-xs text-[#94A3B8] mb-1.5">
                              Document / Survey Number
                            </label>
                            <input
                              id="documentNumber"
                              type="text"
                              value={documentNumber}
                              onChange={(e) => setDocumentNumber(e.target.value)}
                              placeholder="Optional reference number"
                              className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <label htmlFor="ownerWalletAddress" className="text-xs text-[#94A3B8]">
                                {tokenInfo.symbol} Wallet Address (to receive payments)
                              </label>
                              <button
                                type="button"
                                disabled={connectingWallet}
                                onClick={() => void handleAutoFillWallet()}
                                className="text-[11px] font-medium text-[#38BDF8] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                {connectingWallet ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Wallet className="h-3 w-3" />
                                )}
                                <span>{connectingWallet ? 'Connecting…' : 'Connect Wallet'}</span>
                              </button>
                            </div>
                            <input
                              id="ownerWalletAddress"
                              type="text"
                              value={ownerWalletAddress}
                              onChange={(e) => setOwnerWalletAddress(e.target.value)}
                              placeholder="0x..."
                              spellCheck={false}
                              className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="description" className="block text-xs text-[#94A3B8] mb-1.5">
                            Description &amp; Nearby Landmarks
                          </label>
                          <textarea
                            id="description"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Dry land, fenced with gate, tarred road access..."
                            className="w-full p-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compact Pre-Submit Snapshot & Summary */}
                  {(gisMapImageUrl || numericArea > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[rgba(91,133,167,0.16)] text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {gisMapImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={gisMapImageUrl}
                            alt="Captured map preview"
                            className="h-12 w-16 rounded object-cover border border-[#38BDF8]/40 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-[#F4F7FB] truncate">
                            {title.trim() || buildShortTitleFromLocation(location) || 'Land Parcel'} · {state}
                          </p>
                          <p className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                            {numericArea > 0 ? `${numericArea.toLocaleString()} sqm` : 'No size'}
                            {gisPolygon.length >= 3 ? ` · ${gisPolygon.length} corners drawn` : ''}
                            {forSale && numericPriceToken > 0
                              ? ` · ${formatTokenAmount(numericPriceToken, tokenInfo.symbol)}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    {viewMode === 'guided' && (
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="h-12 px-5 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-sm font-medium text-[#E2E8F0] hover:border-[#38BDF8] inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Map</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 h-12 px-6 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Check className="h-4 w-4" />
                      <span>{submitting ? 'Submitting Land Registration…' : 'Register Land'}</span>
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          )}
        </div>
      </main>

      <WalletConnectModal
        open={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        detectedWallets={detectedWallets}
        connectedWallet={connectedWallet}
        connecting={connectingWallet}
        error={walletModalError}
        deepLinkPath="/register"
        onSelectWallet={async (wallet) => {
          await connectSelectedWallet(wallet);
        }}
        onDisconnect={() => {
          setConnectedProvider(null);
          setConnectedWallet(null);
          setWalletModalError(null);
        }}
      />
    </div>
  );
}
