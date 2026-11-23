'use client';

import { useEffect, useState, useMemo, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { ParcelMiniMap } from '@/components/gis/ParcelMiniMap';
import { GoogleSignUpButton } from '@/components/auth/GoogleSignUpButton';
import { ContractRegistryPanel } from '@/components/web3/ContractRegistryPanel';
import { WalletConnectModal } from '@/components/web3/WalletConnectModal';
import {
  getLandListings,
  updateLandListing,
  getPurchaseOrders,
  getListingPriceUsd,
  getListingPriceToken,
  tokenToUsd,
  formatUsd,
  formatListingTokenPrice,
  formatTokenAmount,
  formatFileSize,
  NGN_PER_USD,
  type LandListing,
  type LandDocument,
  type LandPurchaseOrder,
} from '@/lib/land-store';
import { useIntegratedToken } from '@/lib/use-integrated-token';
import {
  createClient,
  clearDemoSession,
  isSupabaseConfigured,
} from '@/lib/supabase';
import {
  INITIAL_USER_ACCOUNTS,
  getActiveUserAccount,
  setActiveUserAccount,
  clearActiveUserAccount,
  signInUser,
  createUserAccount,
  syncSupabaseUserToLocalProfile,
  updateUserProfile,
  getLandsForUser,
  getBuyerOrdersForUser,
  getSellerOrdersForUser,
  getRoleLabel,
  validateRoleInviteCode,
  type UserAccount,
  type UserRole,
} from '@/lib/user-store';
import {
  subscribeWalletDiscovery,
  discoverAllWallets,
  connectWalletProvider,
  isMobileDevice,
  isAndroidDevice,
  triggerDeviceEthereumWalletIntent,
  formatShortAddress,
  getChainName,
  mapWalletError,
  type DetectedWalletProvider,
  type ConnectedWalletState,
} from '@/lib/web3-wallet';
import {
  User,
  MapPin,
  Maximize2,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  LogOut,
  Plus,
  ShoppingBag,
  CreditCard,
  Eye,
  Download,
  Upload,
  X,
  Wallet,
  Phone,
  Mail,
  ArrowRight,
  Tag,
  ShieldCheck,
  Map as MapIcon,
  Layers,
  Activity,
  Menu,
  Compass,
  Settings,
  Loader2,
  KeyRound,
  Landmark,
} from 'lucide-react';

type SidebarSection =
  | 'all_lands'
  | 'approved'
  | 'pending'
  | 'sold'
  | 'rejected'
  | 'payment'
  | 'contracts'
  | 'activities'
  | 'profile';

interface ActivityEvent {
  id: string;
  timestamp: string;
  category: 'registration' | 'verification' | 'document' | 'payment';
  title: string;
  detail: string;
  statusLabel: string;
  statusTone: 'emerald' | 'amber' | 'sky' | 'rose';
  land?: LandListing;
}

export default function UserDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [allListings, setAllListings] = useState<LandListing[]>([]);
  const [allOrders, setAllOrders] = useState<LandPurchaseOrder[]>([]);

  // Auth form state (when not signed in)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('user');
  const [signupInviteCode, setSignupInviteCode] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupWallet, setSignupWallet] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard Sidebar & UI state
  const [activeSection, setActiveSection] = useState<SidebarSection>('all_lands');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectLand, setInspectLand] = useState<LandListing | null>(null);
  const [inspectVisualTab, setInspectVisualTab] = useState<'map' | 'photo'>('map');
  const [previewDoc, setPreviewDoc] = useState<LandDocument | null>(null);
  const [editingPriceLand, setEditingPriceLand] = useState<LandListing | null>(null);
  const [newPriceToken, setNewPriceToken] = useState('');

  // Profile edit state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileWallet, setProfileWallet] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Web3 Wallet state
  const [detectedWallets, setDetectedWallets] = useState<DetectedWalletProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<DetectedWalletProvider | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletState | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { tokenInfo } = useIntegratedToken(activeProvider?.provider ?? null);

  const loadData = () => {
    const user = getActiveUserAccount();
    setActiveUser(user);
    setAllListings(getLandListings());
    setAllOrders(getPurchaseOrders());
    if (user) {
      setProfileName(user.fullName);
      setProfilePhone(user.phone === 'Not provided' ? '' : user.phone);
      setProfileEmail(user.email === 'Not provided' ? '' : user.email);
      setProfileWallet(user.walletAddress ?? '');
    }
  };

  const connectWithWallet = async (
    wallet: DetectedWalletProvider,
    options?: { targetUser?: UserAccount | null; closeOnSuccess?: boolean },
  ) => {
    setWalletConnecting(true);
    setWalletError(null);
    setActiveProvider(wallet);
    try {
      const connected = await connectWalletProvider(wallet);
      setConnectedWallet(connected);
      setProfileWallet(connected.address);

      const userToUpdate = options?.targetUser ?? getActiveUserAccount();
      if (userToUpdate) {
        const updated = updateUserProfile(userToUpdate.id, {
          walletAddress: connected.address,
        });
        if (updated) {
          setActiveUser(updated);
        }
      }

      if (options?.closeOnSuccess !== false) {
        setShowWalletModal(false);
      }
      return connected;
    } catch (err) {
      setWalletError(mapWalletError(err));
      setShowWalletModal(true);
      return null;
    } finally {
      setWalletConnecting(false);
    }
  };

  useEffect(() => {
    let shouldAutoConnect = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'signup') {
        setAuthMode('signup');
      } else if (mode === 'signin') {
        setAuthMode('signin');
      }
      shouldAutoConnect = params.get('connectWallet') === '1';
    }

    setIsMobile(isMobileDevice());
    loadData();
    setMounted(true);

    const unsubscribe = subscribeWalletDiscovery((wallets) => {
      setDetectedWallets(wallets);
    });

    if (shouldAutoConnect) {
      const current = getActiveUserAccount();
      if (current) {
        void discoverAllWallets(450).then((wallets) => {
          setDetectedWallets(wallets);
          if (wallets.length === 1) {
            void connectWithWallet(wallets[0], { targetUser: current });
          } else {
            setShowWalletModal(true);
          }
        });
      }
    }

    const handleSync = () => loadData();
    window.addEventListener('anagu-user-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      unsubscribe();
      window.removeEventListener('anagu-user-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Sync wallet account / network changes automatically
  useEffect(() => {
    const provider = activeProvider?.provider;
    if (!provider?.on || !provider?.removeListener) return;

    const handleAccountsChanged = (accountsArg: unknown) => {
      const accounts = Array.isArray(accountsArg) ? (accountsArg as string[]) : [];
      if (accounts.length === 0) {
        setConnectedWallet(null);
        return;
      }
      const nextAddress = accounts[0];
      setConnectedWallet((prev) => (prev ? { ...prev, address: nextAddress } : prev));
      setProfileWallet(nextAddress);
      const current = getActiveUserAccount();
      if (current) {
        const updated = updateUserProfile(current.id, { walletAddress: nextAddress });
        if (updated) setActiveUser(updated);
      }
    };

    const handleChainChanged = (chainIdArg: unknown) => {
      const chainId = typeof chainIdArg === 'string' ? chainIdArg : '0x1';
      setConnectedWallet((prev) =>
        prev ? { ...prev, chainId, chainName: getChainName(chainId) } : prev,
      );
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [activeProvider]);

  const myLands = useMemo(() => {
    if (!activeUser) return [];
    return getLandsForUser(activeUser, allListings);
  }, [activeUser, allListings]);

  const approvedLands = useMemo(
    () => myLands.filter((l) => l.approvalStatus === 'approved'),
    [myLands],
  );
  const pendingLands = useMemo(
    () => myLands.filter((l) => l.approvalStatus === 'pending_review'),
    [myLands],
  );
  const soldLands = useMemo(
    () => myLands.filter((l) => l.saleStatus === 'sold'),
    [myLands],
  );
  const rejectedLands = useMemo(
    () => myLands.filter((l) => l.approvalStatus === 'rejected'),
    [myLands],
  );

  const displayedLands = useMemo(() => {
    if (activeSection === 'approved') return approvedLands;
    if (activeSection === 'pending') return pendingLands;
    if (activeSection === 'sold') return soldLands;
    if (activeSection === 'rejected') return rejectedLands;
    return myLands;
  }, [activeSection, myLands, approvedLands, pendingLands, soldLands, rejectedLands]);

  const myPurchases = useMemo(() => {
    if (!activeUser) return [];
    return getBuyerOrdersForUser(activeUser, allOrders);
  }, [activeUser, allOrders]);

  const myIncomingOrders = useMemo(() => {
    if (!activeUser) return [];
    return getSellerOrdersForUser(activeUser, allListings, allOrders);
  }, [activeUser, allListings, allOrders]);

  const activityFeed = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];

    for (const land of myLands) {
      events.push({
        id: `act-reg-${land.id}`,
        timestamp: land.createdAt,
        category: 'registration',
        title: `Registered ${land.title}`,
        detail: `${land.parcelRef} · ${land.location}, ${land.state} (${land.areaSqm.toLocaleString()} sqm)`,
        statusLabel:
          land.approvalStatus === 'approved'
            ? 'Approved & Verified'
            : land.approvalStatus === 'rejected'
              ? 'Needs Review'
              : 'Pending Verification',
        statusTone:
          land.approvalStatus === 'approved'
            ? 'emerald'
            : land.approvalStatus === 'rejected'
              ? 'rose'
              : 'amber',
        land,
      });

      for (const doc of land.documents ?? []) {
        events.push({
          id: `act-doc-${doc.id}`,
          timestamp: doc.uploadedAt || land.createdAt,
          category: 'document',
          title: `Document Uploaded: ${doc.name}`,
          detail: `Attached to ${land.parcelRef} · ${formatFileSize(doc.size)}`,
          statusLabel: 'Document Stored',
          statusTone: 'sky',
          land,
        });
      }
    }

    for (const order of myPurchases) {
      const tokenDisplay = order.tokenAmountPaid
        ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
        : formatListingTokenPrice(order, order.tokenSymbol || tokenInfo.symbol);
      events.push({
        id: `act-buy-${order.id}`,
        timestamp: order.createdAt,
        category: 'payment',
        title: `Land Purchase Payment: ${order.landTitle}`,
        detail: `${order.id} · ${tokenDisplay} (≈ ${formatUsd(getListingPriceUsd(order))}) via ${order.paymentMethod}`,
        statusLabel: order.status === 'completed' ? 'Payment Completed' : 'Pending Settlement',
        statusTone: order.status === 'completed' ? 'emerald' : 'amber',
      });
    }

    for (const order of myIncomingOrders) {
      const tokenDisplay = order.tokenAmountPaid
        ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
        : formatListingTokenPrice(order, order.tokenSymbol || tokenInfo.symbol);
      events.push({
        id: `act-sell-${order.id}`,
        timestamp: order.createdAt,
        category: 'payment',
        title: `Buyer Order Received from ${order.buyerName}`,
        detail: `${order.landTitle} (${order.parcelRef}) · ${tokenDisplay} (≈ ${formatUsd(getListingPriceUsd(order))})`,
        statusLabel: order.status === 'completed' ? 'Payment Settled' : 'Pending Settlement',
        statusTone: order.status === 'completed' ? 'emerald' : 'amber',
      });
    }

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [myLands, myPurchases, myIncomingOrders, tokenInfo.symbol]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setAuthError('Please enter your email address or phone number.');
      return;
    }

    if (isSupabaseConfigured() && identifier.includes('@')) {
      if (!loginPassword) {
        const localOnly = signInUser(identifier);
        if (localOnly.user) {
          setLoginIdentifier('');
          loadData();
          return;
        }
        setAuthError('Please enter your password to sign in with your email.');
        return;
      }

      setAuthSubmitting(true);
      try {
        clearDemoSession();
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password: loginPassword,
        });
        if (error || !data.user) {
          setAuthError(error?.message || 'Invalid email or password.');
          return;
        }
        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
        syncSupabaseUserToLocalProfile({
          email: data.user.email || identifier,
          fullName: typeof meta.full_name === 'string' ? meta.full_name : undefined,
          phone: typeof meta.phone === 'string' ? meta.phone : undefined,
          role:
            typeof appMeta.role === 'string'
              ? appMeta.role
              : typeof meta.role === 'string'
                ? meta.role
                : undefined,
          walletAddress:
            typeof meta.wallet_address === 'string' ? meta.wallet_address : undefined,
        });
        setLoginIdentifier('');
        setLoginPassword('');
        loadData();
        return;
      } finally {
        setAuthSubmitting(false);
      }
    }

    const { user, error } = signInUser(identifier);
    if (error || !user) {
      setAuthError(error || 'Unable to sign in.');
      return;
    }
    setLoginIdentifier('');
    setLoginPassword('');
    loadData();
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);

    if (signupRole === 'registrar' || signupRole === 'governor') {
      const check = validateRoleInviteCode(signupInviteCode, signupRole);
      if (!check.valid) {
        setAuthError(
          check.error ||
            'A valid administrator authorization code is required to register for this role.',
        );
        return;
      }
    }

    if (!signupName.trim()) {
      setAuthError('Please enter your full name or company name.');
      return;
    }
    if (!signupPhone.trim()) {
      setAuthError('Please enter your phone number.');
      return;
    }
    if (signupEmail.trim() && !signupEmail.includes('@')) {
      setAuthError('Please enter a valid email address or leave email blank.');
      return;
    }

    const supabaseReady = isSupabaseConfigured();
    if (supabaseReady) {
      if (!signupEmail.trim()) {
        setAuthError('Email address is required to register an account.');
        return;
      }
      if (signupPassword.length < 6) {
        setAuthError('Please choose a password of at least 6 characters.');
        return;
      }

      setAuthSubmitting(true);
      try {
        clearDemoSession();
        const supabase = createClient();
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: signupEmail.trim(),
          password: signupPassword,
          options: {
            data: {
              full_name: signupName.trim(),
              phone: signupPhone.trim(),
              role: signupRole === 'user' ? 'citizen' : signupRole,
              wallet_address: signupWallet.trim() || undefined,
            },
          },
        });

        if (signUpErr) {
          setAuthError(signUpErr.message);
          return;
        }

        if (!data.session) {
          setAuthNotice(
            `Account created for ${signupEmail.trim()}. Please check your email to confirm your address, then sign in.`,
          );
          setSignupPassword('');
          setAuthMode('signin');
          setLoginIdentifier(signupEmail.trim());
          return;
        }
      } finally {
        setAuthSubmitting(false);
      }
    }

    const { user, error } = createUserAccount({
      fullName: signupName,
      phone: signupPhone,
      email: signupEmail,
      walletAddress: signupWallet,
      role: signupRole,
      inviteCode: signupInviteCode,
    });

    if (error || !user) {
      setAuthError(error || 'Unable to create account.');
      return;
    }
    setSignupName('');
    setSignupPhone('');
    setSignupEmail('');
    setSignupPassword('');
    setSignupWallet('');
    setSignupInviteCode('');
    setSignupRole('user');
    loadData();
  };

  const handleQuickDemoSignIn = (userId: string) => {
    setAuthError(null);
    setAuthNotice(null);
    setActiveUserAccount(userId);
    loadData();
  };

  const handleSignOut = () => {
    clearActiveUserAccount();
    clearDemoSession();
    void createClient().auth.signOut();
    setActiveUser(null);
    setInspectLand(null);
    setSidebarOpen(false);
  };

  const handleToggleSale = (land: LandListing) => {
    if (land.saleStatus === 'sold') return;
    const nextForSale = !land.forSale;
    const next = updateLandListing(land.id, {
      forSale: nextForSale,
      saleStatus: nextForSale ? 'available' : 'not_for_sale',
    });
    setAllListings(next);
    if (inspectLand?.id === land.id) {
      setInspectLand(next.find((l) => l.id === land.id) ?? null);
    }
  };

  const handleSavePrice = (e: FormEvent) => {
    e.preventDefault();
    if (!editingPriceLand) return;
    const tokens = Number(newPriceToken.replace(/[^0-9.]/g, ''));
    if (!tokens || tokens <= 0) return;
    const roundedTokens = Math.round(tokens * 100) / 100;
    const usd = tokenToUsd(roundedTokens);
    const next = updateLandListing(editingPriceLand.id, {
      forSale: true,
      saleStatus: editingPriceLand.saleStatus === 'sold' ? 'sold' : 'available',
      priceToken: roundedTokens,
      tokenSymbol: tokenInfo.symbol,
      priceUsd: usd,
      priceNgn: usd * NGN_PER_USD,
    });
    setAllListings(next);
    setEditingPriceLand(null);
    setNewPriceToken('');
  };

  const handleUploadExtraDoc = async (land: LandListing, e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const addedDocs: LandDocument[] = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<LandDocument>((resolve) => {
            const base: LandDocument = {
              id: `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream',
              uploadedAt: new Date().toISOString(),
            };
            if (file.size <= 500 * 1024) {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  ...base,
                  dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
                });
              reader.onerror = () => resolve(base);
              reader.readAsDataURL(file);
            } else {
              resolve(base);
            }
          }),
      ),
    );

    const next = updateLandListing(land.id, {
      documents: [...(land.documents ?? []), ...addedDocs],
    });
    setAllListings(next);
    if (inspectLand?.id === land.id) {
      setInspectLand(next.find((l) => l.id === land.id) ?? null);
    }
    e.target.value = '';
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!activeUser || !profileName.trim() || !profilePhone.trim()) return;
    const updated = updateUserProfile(activeUser.id, {
      fullName: profileName.trim(),
      phone: profilePhone.trim(),
      email: profileEmail.trim() || 'Not provided',
      walletAddress: profileWallet.trim() || undefined,
    });
    if (updated) {
      setActiveUser(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  };

  const handleConnectWalletClick = async () => {
    setWalletError(null);
    setSidebarOpen(false);
    const wallets = await discoverAllWallets(300);
    setDetectedWallets(wallets);

    if (!connectedWallet && wallets.length === 1) {
      void connectWithWallet(wallets[0]);
      return;
    }

    setShowWalletModal(true);
  };

  const handleDisconnectWallet = () => {
    setConnectedWallet(null);
    setActiveProvider(null);
    setWalletError(null);
  };

  const handleConnectSignupWallet = async () => {
    setAuthError(null);
    setWalletError(null);
    const wallets = await discoverAllWallets(300);
    setDetectedWallets(wallets);

    if (wallets.length === 1) {
      setWalletConnecting(true);
      try {
        const connected = await connectWalletProvider(wallets[0]);
        setConnectedWallet(connected);
        setActiveProvider(wallets[0]);
        setSignupWallet(connected.address);
      } catch (err) {
        setAuthError(mapWalletError(err));
      } finally {
        setWalletConnecting(false);
      }
      return;
    }

    if (wallets.length === 0 && isMobile && isAndroidDevice()) {
      triggerDeviceEthereumWalletIntent();
    }
    setShowWalletModal(true);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#020305] text-[#F4F7FB]">
        <main className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </main>
      </div>
    );
  }

  // User Sign-In / Account Creation Gate (Strictly User Site — zero Admin links)
  if (!activeUser) {
    const sampleUsers = INITIAL_USER_ACCOUNTS.slice(0, 3);
    return (
      <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex flex-col">
        <Navbar />

        <main className="flex-1 pt-28 pb-20 px-4">
          <div className="mx-auto max-w-xl space-y-6">
            <div className="text-center space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[#38BDF8]">
                Landowner &amp; Buyer Account
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[#F4F7FB]">
                {authMode === 'signup'
                  ? 'Create Your Anagu Account'
                  : 'Monitor Your Registered Lands'}
              </h1>
              <p className="text-sm text-[#94A3B8]">
                {authMode === 'signup'
                  ? 'Sign up with Google or create an account below to buy land, register parcels, and monitor your portfolio.'
                  : 'Sign in or create your personal account to track approval progress, manage sale listings, and view payments.'}
              </p>
            </div>

            <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-6 sm:p-8 shadow-xl space-y-6">
              {/* Toggle Sign In / Create Account */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError(null);
                  }}
                  className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                    authMode === 'signin'
                      ? 'bg-[#38BDF8] text-[#020305]'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError(null);
                  }}
                  className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                    authMode === 'signup'
                      ? 'bg-[#38BDF8] text-[#020305]'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authNotice && (
                <div
                  role="status"
                  className="rounded-lg bg-emerald-950/30 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-300"
                >
                  {authNotice}
                </div>
              )}

              {authError && (
                <div
                  role="alert"
                  className="rounded-lg bg-rose-950/30 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-300"
                >
                  {authError}
                </div>
              )}

              {authMode === 'signup' && (
                <div className="space-y-3 rounded-xl bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#F4F7FB]">
                      Select Account Type *
                    </span>
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {getRoleLabel(signupRole)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSignupRole('user');
                        setSignupInviteCode('');
                        setAuthError(null);
                      }}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                        signupRole === 'user'
                          ? 'bg-[#38BDF8] text-[#020305] border-[#67E8F9]'
                          : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Normal Users</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSignupRole('registrar');
                        setAuthError(null);
                      }}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                        signupRole === 'registrar'
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                          : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Registrar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSignupRole('governor');
                        setAuthError(null);
                      }}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                        signupRole === 'governor'
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                          : 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                      }`}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      <span>Governor</span>
                    </button>
                  </div>

                  {signupRole === 'user' ? (
                    <p className="text-[11px] text-[#94A3B8]">
                      Standard user account for landowners and buyers. No authorization code required.
                    </p>
                  ) : (
                    <div className="pt-1 space-y-1.5">
                      <label
                        htmlFor="signup-invite-code"
                        className="flex items-center gap-1.5 text-xs font-medium text-[#F4F7FB]"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                        <span>
                          {signupRole === 'governor' ? 'Governor' : 'Registrar'} Authorization Code *
                        </span>
                      </label>
                      <input
                        id="signup-invite-code"
                        type="text"
                        required
                        value={signupInviteCode}
                        onChange={(e) => setSignupInviteCode(e.target.value.toUpperCase())}
                        placeholder={
                          signupRole === 'governor' ? 'e.g. GOV-XXXX-XXXX' : 'e.g. REG-XXXX-XXXX'
                        }
                        className="w-full h-10 px-3 rounded-[8px] bg-[#0A0F16] border border-amber-500/40 text-sm font-mono uppercase tracking-wider text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                      <p className="text-[11px] text-amber-300/90">
                        Single-use code: valid for 1 {signupRole === 'governor' ? 'Governor' : 'Registrar'} account only and expires immediately after registration.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <GoogleSignUpButton
                  label={authMode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                  role={authMode === 'signup' ? signupRole : 'user'}
                  inviteCode={authMode === 'signup' ? signupInviteCode : ''}
                  onSuccess={() => {
                    setAuthError(null);
                    setSignupInviteCode('');
                    setSignupRole('user');
                    loadData();
                  }}
                  onError={(msg) => setAuthError(msg)}
                />

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-[rgba(91,133,167,0.20)]" />
                  <span className="mx-3 text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
                    or with email / phone
                  </span>
                  <div className="flex-grow border-t border-[rgba(91,133,167,0.20)]" />
                </div>
              </div>

              {authMode === 'signin' ? (
                <form onSubmit={(e) => void handleSignIn(e)} className="space-y-4">
                  <div>
                    <label htmlFor="user-identifier" className="block text-xs text-[#94A3B8] mb-1.5">
                      Email Address or Phone Number
                    </label>
                    <input
                      id="user-identifier"
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="e.g. name@example.com or +234 803 412 8890"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-password" className="block text-xs text-[#94A3B8] mb-1.5">
                      Password {isSupabaseConfigured() ? '*' : '(Optional for local demo)'}
                    </label>
                    <input
                      id="user-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-[#64748B]">
                      Existing Normal Users, Registrars, and Governors sign in directly — authorization codes are only required once when creating an official account.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full h-11 rounded-[8px] bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {authSubmitting ? 'Signing In…' : 'Open My Land Dashboard'}
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => void handleSignUp(e)} className="space-y-4">
                  <div>
                    <label htmlFor="signup-name" className="block text-xs text-[#94A3B8] mb-1.5">
                      Full Name or Company Name *
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Babatunde Adeleke"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="signup-phone" className="block text-xs text-[#94A3B8] mb-1.5">
                        Phone Number *
                      </label>
                      <input
                        id="signup-phone"
                        type="tel"
                        required
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        placeholder="+234 803 123 4567"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="signup-email" className="block text-xs text-[#94A3B8] mb-1.5">
                        Email Address {isSupabaseConfigured() ? '*' : '(Optional)'}
                      </label>
                      <input
                        id="signup-email"
                        type="email"
                        required={isSupabaseConfigured()}
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-password" className="block text-xs text-[#94A3B8] mb-1.5">
                      Password {isSupabaseConfigured() ? '* (min 6 characters)' : '(Optional for local demo)'}
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      required={isSupabaseConfigured()}
                      minLength={6}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Create a password (min 6 characters)"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label htmlFor="signup-wallet" className="text-xs text-[#94A3B8]">
                        {tokenInfo.symbol} Token Wallet Address (Optional)
                      </label>
                      <button
                        type="button"
                        disabled={walletConnecting}
                        onClick={() => void handleConnectSignupWallet()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/35 text-[11px] font-medium text-[#67E8F9] hover:bg-[#38BDF8]/20 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {walletConnecting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        <span>{walletConnecting ? 'Connecting…' : 'Connect Wallet'}</span>
                      </button>
                    </div>
                    <input
                      id="signup-wallet"
                      type="text"
                      value={signupWallet}
                      onChange={(e) => setSignupWallet(e.target.value)}
                      placeholder="0x..."
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full h-11 rounded-[8px] bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {authSubmitting
                      ? 'Creating Account…'
                      : `Create ${getRoleLabel(signupRole)} Account & Continue`}
                  </button>
                </form>
              )}

              {/* Quick Landowner Access */}
              <div className="pt-4 border-t border-[rgba(91,133,167,0.18)] space-y-2.5">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
                  Quick Access (Sample Landowner Accounts)
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {sampleUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickDemoSignIn(u.id)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)] hover:border-[#38BDF8]/50 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F4F7FB] truncate">
                          {u.fullName}
                        </p>
                        <p className="text-[11px] font-mono text-[#64748B] truncate">
                          {u.email} · {u.phone}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-[#38BDF8] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        <WalletConnectModal
          open={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          detectedWallets={detectedWallets}
          connectedWallet={connectedWallet}
          connecting={walletConnecting}
          error={walletError}
          deepLinkPath="/dashboard?mode=signup"
          onSelectWallet={async (wallet) => {
            const connected = await connectWithWallet(wallet, {
              targetUser: null,
              closeOnSuccess: true,
            });
            if (connected) {
              setSignupWallet(connected.address);
            }
          }}
          onDisconnect={handleDisconnectWallet}
        />
      </div>
    );
  }

  const totalPaymentsCount = myPurchases.length + myIncomingOrders.length;

  const sectionLabels: Record<SidebarSection, string> = {
    all_lands: 'My Registered Land',
    approved: 'Approved & Verified',
    pending: 'Pending Verification',
    sold: 'Sold Lands',
    rejected: 'Needs Revision / Rejected',
    payment: 'Payment & Orders',
    contracts: 'Smart Contracts (ethers.js)',
    activities: 'Activities',
    profile: 'Account Details',
  };

  const sidebarItems: Array<{
    id: SidebarSection;
    label: string;
    count?: number;
    icon: typeof Layers;
    toneClass?: string;
  }> = [
    {
      id: 'all_lands',
      label: 'My Registered Land',
      count: myLands.length,
      icon: Layers,
    },
    {
      id: 'approved',
      label: 'Approved & Verified',
      count: approvedLands.length,
      icon: CheckCircle2,
      toneClass: 'text-emerald-400',
    },
    {
      id: 'pending',
      label: 'Pending Verification',
      count: pendingLands.length,
      icon: Clock,
      toneClass: 'text-amber-400',
    },
    {
      id: 'sold',
      label: 'Sold',
      count: soldLands.length,
      icon: Tag,
      toneClass: 'text-[#38BDF8]',
    },
    {
      id: 'payment',
      label: 'Payment',
      count: totalPaymentsCount,
      icon: CreditCard,
    },
    {
      id: 'contracts',
      label: 'Smart Contracts',
      icon: ShieldCheck,
      toneClass: 'text-[#67E8F9]',
    },
    {
      id: 'activities',
      label: 'Activities',
      count: activityFeed.length,
      icon: Activity,
    },
  ];

  const selectSidebarView = (section: SidebarSection) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Sidebar Brand */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-[rgba(91,133,167,0.18)] shrink-0">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.28)]">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-[#38BDF8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
              <polyline points="12 6 12 12 18 15" />
              <circle cx="12" cy="12" r="1.5" fill="#67E8F9" />
            </svg>
          </div>
          <div>
            <span className="block font-semibold tracking-wider text-sm text-[#F4F7FB]">
              ANAGU
            </span>
            <span className="block text-[11px] text-[#64748B]">Landowner Portal</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#94A3B8] hover:text-white"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Sidebar Views */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <div className="space-y-1">
          <p className="px-3 pb-1.5 text-[11px] font-medium text-[#64748B]">
            Land &amp; Activity
          </p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSidebarView(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#38BDF8]/15 text-[#F4F7FB] border border-[#38BDF8]/35'
                    : 'text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#0A0F16] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-[#38BDF8]' : item.toneClass ?? 'text-[#64748B]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      isActive ? 'text-[#67E8F9]' : 'text-[#64748B]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Moved Actions Section (Register Land & Explore Land live here, NOT at the top) */}
        <div className="space-y-1.5 pt-4 border-t border-[rgba(91,133,167,0.16)]">
          <p className="px-3 pb-1 text-[11px] font-medium text-[#64748B]">
            Actions
          </p>
          <Link
            href="/register"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Register Land</span>
          </Link>
          <Link
            href="/explore"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#0A0F16] text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Compass className="h-4 w-4 shrink-0 text-[#38BDF8]" />
            <span>Explore Land</span>
          </Link>
          <button
            type="button"
            onClick={handleConnectWalletClick}
            disabled={walletConnecting}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              connectedWallet
                ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-300 hover:border-emerald-400'
                : 'bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-[#E2E8F0] hover:border-[#38BDF8]/50 hover:text-[#67E8F9]'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {walletConnecting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#38BDF8]" />
              ) : (
                <Wallet
                  className={`h-4 w-4 shrink-0 ${
                    connectedWallet ? 'text-emerald-400' : 'text-[#38BDF8]'
                  }`}
                />
              )}
              <span className="truncate">
                {walletConnecting
                  ? 'Connecting Wallet…'
                  : connectedWallet
                    ? `Wallet: ${formatShortAddress(connectedWallet.address)}`
                    : 'Connect Wallet'}
              </span>
            </span>
          </button>
          {activeUser.role === 'registrar' && (
            <Link
              href="/registrar"
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-200 hover:bg-sky-500/25 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-sky-400" />
              <span>Registrar Portal</span>
            </Link>
          )}
          {activeUser.role === 'governor' && (
            <Link
              href="/governor"
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 hover:bg-amber-500/25 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Landmark className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Governor Portal</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => selectSidebarView('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeSection === 'profile'
                ? 'bg-[#38BDF8]/15 text-[#F4F7FB] border border-[#38BDF8]/35'
                : 'text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-[#0A0F16] border border-transparent'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 text-[#64748B]" />
            <span>Account Details</span>
          </button>
        </div>
      </div>

      {/* Signed-In Account Footer */}
      <div className="p-4 border-t border-[rgba(91,133,167,0.18)] space-y-3 shrink-0 bg-[#05080D]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-[#0A0F16] border border-[#38BDF8]/35 flex items-center justify-center text-[#38BDF8] shrink-0">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-[#F4F7FB] truncate">
                {activeUser.fullName}
              </p>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0 ${
                  activeUser.role === 'governor'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    : activeUser.role === 'registrar'
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {getRoleLabel(activeUser.role)}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] truncate">
              {activeUser.email !== 'Not provided' ? activeUser.email : activeUser.phone}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-9 px-3 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] hover:border-rose-500/40 text-xs text-[#94A3B8] hover:text-rose-300 inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  const isLandView =
    activeSection === 'all_lands' ||
    activeSection === 'approved' ||
    activeSection === 'pending' ||
    activeSection === 'sold' ||
    activeSection === 'rejected';

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 xl:w-72 lg:shrink-0 border-r border-[rgba(91,133,167,0.18)] bg-[#06090F] sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#06090F] border-r border-[rgba(91,133,167,0.24)] flex flex-col">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Contextual Workspace Top Bar (No Home, Explore Land, or Register Land buttons at top) */}
        <header className="sticky top-0 z-30 h-16 border-b border-[rgba(91,133,167,0.16)] bg-[#020305]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-white shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-[#64748B] hidden sm:inline">My Portfolio</span>
              <span className="text-[#475569] hidden sm:inline">/</span>
              <h1 className="font-semibold text-[#F4F7FB] truncate">
                {sectionLabels[activeSection]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#94A3B8] shrink-0">
            <span className="hidden md:inline font-medium text-[#E2E8F0] truncate max-w-[180px]">
              {activeUser.fullName}
            </span>
            <button
              type="button"
              onClick={handleConnectWalletClick}
              disabled={walletConnecting}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                connectedWallet
                  ? 'bg-[#0A0F16] border border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                  : 'bg-[#38BDF8] text-[#020305] hover:bg-[#67E8F9]'
              }`}
            >
              {walletConnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              <span>
                {walletConnecting
                  ? 'Connecting…'
                  : connectedWallet
                    ? formatShortAddress(connectedWallet.address)
                    : 'Connect Wallet'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 space-y-7 max-w-6xl w-full mx-auto">
          {/* Account Summary Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => selectSidebarView('all_lands')}
              className={`text-left rounded-[12px] bg-[#0A0F16] border p-5 transition-colors ${
                activeSection === 'all_lands'
                  ? 'border-[#38BDF8]/50'
                  : 'border-[rgba(91,133,167,0.20)] hover:border-[rgba(91,133,167,0.38)]'
              }`}
            >
              <p className="text-xs text-[#94A3B8]">My Registered Land</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#F4F7FB]">
                {myLands.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectSidebarView('approved')}
              className={`text-left rounded-[12px] bg-[#0A0F16] border p-5 transition-colors ${
                activeSection === 'approved'
                  ? 'border-emerald-400/50'
                  : 'border-[rgba(91,133,167,0.20)] hover:border-[rgba(91,133,167,0.38)]'
              }`}
            >
              <p className="text-xs text-[#94A3B8]">Approved &amp; Verified</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {approvedLands.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectSidebarView('pending')}
              className={`text-left rounded-[12px] bg-[#0A0F16] border p-5 transition-colors ${
                activeSection === 'pending'
                  ? 'border-amber-400/50'
                  : 'border-[rgba(91,133,167,0.20)] hover:border-[rgba(91,133,167,0.38)]'
              }`}
            >
              <p className="text-xs text-[#94A3B8]">Pending Verification</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-400">
                {pendingLands.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectSidebarView('payment')}
              className={`text-left rounded-[12px] bg-[#0A0F16] border p-5 transition-colors ${
                activeSection === 'payment'
                  ? 'border-[#38BDF8]/50'
                  : 'border-[rgba(91,133,167,0.20)] hover:border-[rgba(91,133,167,0.38)]'
              }`}
            >
              <p className="text-xs text-[#94A3B8]">Sold / Payment Activity</p>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#38BDF8]">
                {soldLands.length}{' '}
                <span className="text-xs font-normal text-[#64748B]">
                  sold · {totalPaymentsCount} orders
                </span>
              </p>
            </button>
          </div>

          {/* VIEW 1: Land Views (My Registered Land / Approved / Pending / Sold / Rejected) */}
          {isLandView && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#F4F7FB]">
                    {sectionLabels[activeSection]} ({displayedLands.length})
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    {activeSection === 'all_lands'
                      ? 'All land parcels registered under your account.'
                      : activeSection === 'approved'
                        ? 'Parcels verified and cleared by registry administration.'
                        : activeSection === 'pending'
                          ? 'Parcels currently awaiting survey and document verification.'
                          : activeSection === 'sold'
                            ? 'Parcels that have completed buyer acquisition.'
                            : 'Parcels requiring updated documents or boundary revision.'}
                  </p>
                </div>

                {rejectedLands.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      selectSidebarView(activeSection === 'rejected' ? 'all_lands' : 'rejected')
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      activeSection === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-[#0A0F16] text-rose-300 border border-[rgba(91,133,167,0.22)] hover:border-rose-500/40'
                    }`}
                  >
                    Rejected ({rejectedLands.length})
                  </button>
                )}
              </div>

              {myLands.length === 0 ? (
                <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-12 text-center space-y-4">
                  <p className="text-base font-semibold text-[#F4F7FB]">
                    You have not registered any lands under this account yet.
                  </p>
                  <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
                    Use Register Land in the sidebar to submit your map boundaries and title papers, or browse Explore Land to acquire a parcel.
                  </p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Register Your First Land</span>
                  </Link>
                </div>
              ) : displayedLands.length === 0 ? (
                <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-10 text-center space-y-3">
                  <p className="text-sm text-[#94A3B8]">
                    No parcels currently match &ldquo;{sectionLabels[activeSection]}&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={() => selectSidebarView('all_lands')}
                    className="h-9 px-4 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-xs font-medium text-[#38BDF8] hover:border-[#38BDF8]"
                  >
                    View All Registered Land
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {displayedLands.map((land) => {
                    const usd = getListingPriceUsd(land);
                    const matchingOrder = allOrders.find((o) => o.landId === land.id);

                    return (
                      <article
                        key={land.id}
                        className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] overflow-hidden flex flex-col"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 flex-1">
                          {/* Thumbnail */}
                          <div className="sm:col-span-5 relative aspect-[4/3] sm:aspect-auto bg-[#05080D] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={land.imageUrl}
                              alt={land.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
                            <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-1.5 text-[11px] font-mono">
                              {land.approvalStatus === 'approved' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approved
                                </span>
                              ) : land.approvalStatus === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 text-rose-300 font-medium">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                                  <Clock className="h-3.5 w-3.5" />
                                  Pending Review
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="sm:col-span-7 p-5 flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                                <span className="text-[#38BDF8]">{land.parcelRef}</span>
                                <span
                                  className={
                                    land.saleStatus === 'sold'
                                      ? 'text-rose-400 font-semibold'
                                      : land.forSale
                                        ? 'text-emerald-400 font-semibold'
                                        : 'text-[#64748B]'
                                  }
                                >
                                  {land.saleStatus === 'sold'
                                    ? 'Sold'
                                    : land.forSale
                                      ? 'Listed for Sale'
                                      : 'Registry Only'}
                                </span>
                              </div>

                              <h3 className="text-base font-bold text-[#F4F7FB] leading-snug">
                                {land.title}
                              </h3>

                              <p className="text-xs text-[#94A3B8] flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                                <span>
                                  {land.location}, {land.state}
                                </span>
                              </p>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8] pt-0.5">
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Maximize2 className="h-3 w-3 text-[#64748B]" />
                                  {land.areaSqm.toLocaleString()} sqm
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <FileText className="h-3 w-3 text-[#64748B]" />
                                  {land.documents.length}{' '}
                                  {land.documents.length === 1 ? 'doc' : 'docs'}
                                </span>
                              </div>

                              {land.forSale && getListingPriceToken(land) > 0 && (
                                <div className="pt-1 font-mono tabular-nums">
                                  <span className="text-sm font-bold text-[#67E8F9]">
                                    {formatListingTokenPrice(land, tokenInfo.symbol)}
                                  </span>
                                  <span className="mx-1.5 text-[#475569]">·</span>
                                  <span className="text-xs text-[#94A3B8]">
                                    ≈ {formatUsd(usd)}
                                  </span>
                                </div>
                              )}

                              {matchingOrder && (
                                <div className="pt-2 border-t border-[rgba(91,133,167,0.14)] text-[11px]">
                                  <p className="text-[#94A3B8]">
                                    Buyer Order:{' '}
                                    <strong className="text-[#F4F7FB]">
                                      {matchingOrder.buyerName}
                                    </strong>
                                  </p>
                                  <p
                                    className={`font-mono mt-0.5 ${
                                      matchingOrder.status === 'completed'
                                        ? 'text-emerald-400'
                                        : 'text-amber-400'
                                    }`}
                                  >
                                    {matchingOrder.status === 'completed'
                                      ? 'Payment Completed'
                                      : 'Pending Settlement'}{' '}
                                    · {matchingOrder.paymentMethod}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-[rgba(91,133,167,0.16)] flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectVisualTab('map');
                                  setInspectLand(land);
                                }}
                                className="h-8 px-3 rounded-lg bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Monitor</span>
                              </button>

                              {land.saleStatus !== 'sold' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSale(land)}
                                    className="h-8 px-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.25)] hover:border-[#38BDF8]/50 text-xs text-[#E2E8F0] whitespace-nowrap"
                                  >
                                    {land.forSale ? 'Pause Sale' : 'List for Sale'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const tokenAmt = getListingPriceToken(land);
                                      setEditingPriceLand(land);
                                      setNewPriceToken(tokenAmt > 0 ? String(tokenAmt) : '');
                                    }}
                                    className="h-8 px-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.25)] hover:border-[#38BDF8]/50 text-xs text-[#94A3B8] hover:text-[#F4F7FB] inline-flex items-center gap-1 whitespace-nowrap"
                                    title="Update asking price"
                                  >
                                    <Tag className="h-3 w-3" />
                                    <span>Price</span>
                                  </button>
                                </>
                              )}

                              <label className="h-8 px-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.25)] hover:border-[#38BDF8]/50 text-xs text-[#94A3B8] hover:text-[#F4F7FB] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap">
                                <Upload className="h-3 w-3" />
                                <span>Add Doc</span>
                                <input
                                  type="file"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => void handleUploadExtraDoc(land, e)}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* VIEW 2: Payment & Orders */}
          {activeSection === 'payment' && (
            <section className="space-y-8">
              {/* Payments I Made (as Buyer) */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[#F4F7FB] flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#38BDF8]" />
                  <span>Payments Made (Lands I Purchased)</span>
                </h2>
                {myPurchases.length === 0 ? (
                  <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-8 text-center text-xs text-[#94A3B8]">
                    You have not made any land purchase payments yet. Use{' '}
                    <Link href="/explore" className="text-[#38BDF8] hover:underline">
                      Explore Land
                    </Link>{' '}
                    in the sidebar to browse parcels for sale.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)]">
                    <table className="min-w-full divide-y divide-[rgba(91,133,167,0.16)] text-xs">
                      <thead className="bg-[#05080D]">
                        <tr>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Order ID</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Land Parcel</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Amount Paid</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Method / Wallet</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(91,133,167,0.12)]">
                        {myPurchases.map((order) => (
                          <tr key={order.id} className="hover:bg-[#05080D]/60">
                            <td className="px-5 py-4 font-mono text-[#38BDF8]">{order.id}</td>
                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#F4F7FB]">{order.landTitle}</p>
                              <p className="font-mono text-[#64748B]">{order.parcelRef}</p>
                            </td>
                            <td className="px-5 py-4 font-mono tabular-nums">
                              <p className="font-semibold text-[#67E8F9]">
                                {order.tokenAmountPaid
                                  ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
                                  : formatListingTokenPrice(
                                      order,
                                      order.tokenSymbol || tokenInfo.symbol,
                                    )}
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                ≈ {formatUsd(getListingPriceUsd(order))}
                              </p>
                            </td>
                            <td className="px-5 py-4 text-[#94A3B8]">
                              <p>{order.paymentMethod}</p>
                              {order.walletTxHash && (
                                <p className="font-mono text-[11px] text-emerald-400">
                                  Tx: {order.walletTxHash.slice(0, 10)}…{order.walletTxHash.slice(-6)}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`font-mono text-xs font-medium ${
                                  order.status === 'completed'
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {order.status === 'completed' ? 'Payment Completed' : 'Pending Settlement'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Buyer Payments on My Lands */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-[#F4F7FB] flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-emerald-400" />
                  <span>Buyer Orders on My Listed Lands</span>
                </h2>
                {myIncomingOrders.length === 0 ? (
                  <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-8 text-center text-xs text-[#94A3B8]">
                    No buyers have placed orders on your registered lands yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)]">
                    <table className="min-w-full divide-y divide-[rgba(91,133,167,0.16)] text-xs">
                      <thead className="bg-[#05080D]">
                        <tr>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Order ID</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Buyer</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Land</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Amount</th>
                          <th className="px-5 py-3.5 text-left font-mono uppercase text-[#64748B]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(91,133,167,0.12)]">
                        {myIncomingOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-[#05080D]/60">
                            <td className="px-5 py-4 font-mono text-[#38BDF8]">{order.id}</td>
                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#F4F7FB]">{order.buyerName}</p>
                              <p className="text-[#94A3B8]">
                                {order.buyerEmail} · {order.buyerPhone}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-[#F4F7FB]">{order.landTitle}</p>
                              <p className="font-mono text-[#64748B]">{order.parcelRef}</p>
                            </td>
                            <td className="px-5 py-4 font-mono tabular-nums">
                              <p className="font-semibold text-[#67E8F9]">
                                {order.tokenAmountPaid
                                  ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
                                  : formatListingTokenPrice(
                                      order,
                                      order.tokenSymbol || tokenInfo.symbol,
                                    )}
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">
                                ≈ {formatUsd(getListingPriceUsd(order))}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`font-mono text-xs font-medium ${
                                  order.status === 'completed'
                                    ? 'text-emerald-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {order.status === 'completed' ? 'Payment Settled' : 'Pending Settlement'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* VIEW 2B: Smart Contracts (ethers.js) */}
          {activeSection === 'contracts' && (
            <ContractRegistryPanel
              provider={activeProvider?.provider ?? null}
              walletAddress={connectedWallet?.address ?? activeUser.walletAddress ?? null}
            />
          )}

          {/* VIEW 3: Activities Timeline */}
          {activeSection === 'activities' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#F4F7FB] flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#38BDF8]" />
                  <span>Account Activities ({activityFeed.length})</span>
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Chronological log of your land registrations, document uploads, verifications, and payments.
                </p>
              </div>

              {activityFeed.length === 0 ? (
                <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-10 text-center space-y-3">
                  <p className="text-sm text-[#94A3B8]">
                    No account activity recorded yet.
                  </p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Land</span>
                  </Link>
                </div>
              ) : (
                <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] divide-y divide-[rgba(91,133,167,0.14)]">
                  {activityFeed.map((evt) => (
                    <div
                      key={evt.id}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono tabular-nums text-[#64748B]">
                            {new Date(evt.timestamp).toLocaleDateString()} ·{' '}
                            {new Date(evt.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span aria-hidden="true" className="text-[#475569]">
                            ·
                          </span>
                          <span
                            className={`font-mono font-medium ${
                              evt.statusTone === 'emerald'
                                ? 'text-emerald-400'
                                : evt.statusTone === 'amber'
                                  ? 'text-amber-400'
                                  : evt.statusTone === 'rose'
                                    ? 'text-rose-400'
                                    : 'text-[#38BDF8]'
                            }`}
                          >
                            {evt.statusLabel}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#F4F7FB] truncate">
                          {evt.title}
                        </p>
                        <p className="text-xs text-[#94A3B8]">{evt.detail}</p>
                      </div>

                      {evt.land ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectVisualTab('map');
                            setInspectLand(evt.land ?? null);
                          }}
                          className="h-8 px-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.24)] hover:border-[#38BDF8]/50 text-xs text-[#38BDF8] font-medium shrink-0 self-start sm:self-center"
                        >
                          Inspect Parcel
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectSidebarView('payment')}
                          className="h-8 px-3 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.24)] hover:border-[#38BDF8]/50 text-xs text-[#38BDF8] font-medium shrink-0 self-start sm:self-center"
                        >
                          View Payment
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* VIEW 4: Account Details */}
          {activeSection === 'profile' && (
            <section className="max-w-2xl">
              <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-6 sm:p-8 space-y-5">
                <div className="pb-3 border-b border-[rgba(91,133,167,0.16)]">
                  <h2 className="text-base font-semibold text-[#F4F7FB]">
                    My Account Profile
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Keep your contact and Ethereum wallet details up to date for land registrations and buyer inquiries.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#94A3B8]">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[#38BDF8]" />
                    {activeUser.phone}
                  </span>
                  {activeUser.email && activeUser.email !== 'Not provided' && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-[#38BDF8]" />
                      {activeUser.email}
                    </span>
                  )}
                  {activeUser.walletAddress && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[#67E8F9]">
                      <Wallet className="h-3.5 w-3.5" />
                      {activeUser.walletAddress.slice(0, 6)}…{activeUser.walletAddress.slice(-4)}
                    </span>
                  )}
                </div>

                {profileSaved && (
                  <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/40 px-4 py-2.5 text-xs text-emerald-300">
                    Account profile updated successfully.
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1.5">Full Name / Company</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1.5">Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs text-[#94A3B8]">{tokenInfo.symbol} Token Wallet Address</label>
                      <button
                        type="button"
                        onClick={handleConnectWalletClick}
                        disabled={walletConnecting}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/35 text-[11px] font-medium text-[#67E8F9] hover:bg-[#38BDF8]/20 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                      >
                        {walletConnecting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wallet className="h-3 w-3" />
                        )}
                        <span>
                          {walletConnecting
                            ? 'Connecting Wallet…'
                            : connectedWallet
                              ? `Connected (${formatShortAddress(connectedWallet.address)})`
                              : 'Connect Wallet'}
                        </span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={profileWallet}
                      onChange={(e) => setProfileWallet(e.target.value)}
                      placeholder="0x..."
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-11 px-6 rounded-[8px] bg-[#38BDF8] hover:bg-[#67E8F9] text-[#020305] text-sm font-semibold transition-colors"
                  >
                    Save Changes
                  </button>
                </form>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Monitor / Inspect Land Modal */}
      {inspectLand && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[14px] bg-[#0A0F16] border border-[rgba(91,133,167,0.32)] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(91,133,167,0.18)] pb-4">
              <div>
                <p className="text-xs font-mono text-[#38BDF8]">{inspectLand.parcelRef}</p>
                <h3 className="text-lg font-bold text-[#F4F7FB] mt-0.5">{inspectLand.title}</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {inspectLand.location}, {inspectLand.state}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectLand(null)}
                className="p-1.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-[#94A3B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Map vs Photo Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setInspectVisualTab('map')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
                      inspectVisualTab === 'map'
                        ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                    <span>GIS Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectVisualTab('photo')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
                      inspectVisualTab === 'photo'
                        ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Snapshot</span>
                  </button>
                </div>

                <span className="text-xs font-mono tabular-nums text-[#94A3B8]">
                  {inspectLand.areaSqm.toLocaleString()} sqm · {inspectLand.category}
                </span>
              </div>

              {inspectVisualTab === 'map' ? (
                <div className="h-60 rounded-xl overflow-hidden border border-[rgba(91,133,167,0.25)]">
                  <ParcelMiniMap parcel={inspectLand} />
                </div>
              ) : (
                <div className="aspect-[16/9] rounded-xl overflow-hidden border border-[rgba(91,133,167,0.25)] bg-[#05080D]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspectLand.imageUrl}
                    alt={inspectLand.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Monitoring Timeline */}
            <div className="rounded-xl bg-[#05080D] border border-[rgba(91,133,167,0.20)] p-4 space-y-3">
              <p className="text-xs font-mono uppercase tracking-wider text-[#64748B]">
                Registration &amp; Status Progress
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#0A0F16] border border-emerald-500/30">
                  <p className="text-[#64748B]">1. Submitted</p>
                  <p className="font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Recorded
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-[#64748B] mt-0.5">
                    {new Date(inspectLand.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg bg-[#0A0F16] border ${
                    inspectLand.approvalStatus === 'approved'
                      ? 'border-emerald-500/30'
                      : inspectLand.approvalStatus === 'rejected'
                        ? 'border-rose-500/30'
                        : 'border-amber-500/30'
                  }`}
                >
                  <p className="text-[#64748B]">2. Registry Verification</p>
                  <p
                    className={`font-semibold mt-0.5 flex items-center gap-1 ${
                      inspectLand.approvalStatus === 'approved'
                        ? 'text-emerald-400'
                        : inspectLand.approvalStatus === 'rejected'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {inspectLand.approvalStatus === 'approved'
                      ? 'Verified & Approved'
                      : inspectLand.approvalStatus === 'rejected'
                        ? 'Needs Revision / Rejected'
                        : 'Pending Review'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)]">
                  <p className="text-[#64748B]">3. Marketplace &amp; Sale</p>
                  <p className="font-semibold text-[#F4F7FB] mt-0.5">
                    {inspectLand.saleStatus === 'sold'
                      ? 'Sold / Order Placed'
                      : inspectLand.forSale
                        ? `Listed (${formatListingTokenPrice(inspectLand, tokenInfo.symbol)})`
                        : 'Private Custody Only'}
                  </p>
                </div>
              </div>
            </div>

            {/* Uploaded Documents */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#94A3B8]">
                  Uploaded Land Papers ({inspectLand.documents.length})
                </p>
                <label className="text-xs text-[#38BDF8] hover:text-[#67E8F9] cursor-pointer inline-flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Another File</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleUploadExtraDoc(inspectLand, e)}
                  />
                </label>
              </div>
              {inspectLand.documents.length === 0 ? (
                <p className="text-xs text-[#64748B]">No documents attached yet.</p>
              ) : (
                <div className="space-y-2">
                  {inspectLand.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.20)] text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-[#38BDF8] shrink-0" />
                        <span className="text-[#F4F7FB] truncate">{doc.name}</span>
                        <span className="font-mono text-[#64748B] shrink-0">
                          {formatFileSize(doc.size)}
                        </span>
                      </div>
                      {doc.dataUrl && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="text-[#38BDF8] hover:text-[#67E8F9] p-1"
                            title="Preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={doc.dataUrl}
                            download={doc.name}
                            className="text-emerald-400 hover:text-emerald-300 p-1"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingPriceLand && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-[#0A0F16] border border-[rgba(91,133,167,0.30)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(91,133,167,0.18)] pb-3">
              <h3 className="text-sm font-bold text-[#F4F7FB]">Update Asking Price</h3>
              <button
                type="button"
                onClick={() => setEditingPriceLand(null)}
                className="p-1 text-[#94A3B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSavePrice} className="space-y-4">
              <div>
                <p className="text-xs text-[#94A3B8] mb-2">{editingPriceLand.title}</p>
                <label className="block text-xs text-[#94A3B8] mb-1.5">
                  Asking Price ({tokenInfo.symbol} Token)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={newPriceToken}
                  onChange={(e) => setNewPriceToken(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm font-mono text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                />
                {Number(newPriceToken) > 0 && (
                  <p className="mt-1.5 text-[11px] font-mono text-[#94A3B8]">
                    {formatTokenAmount(Number(newPriceToken), tokenInfo.symbol)} · ≈{' '}
                    {formatUsd(tokenToUsd(Number(newPriceToken)))}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPriceLand(null)}
                  className="flex-1 h-10 rounded-lg border border-[rgba(91,133,167,0.25)] text-xs text-[#94A3B8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold"
                >
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl bg-[#0A0F16] border border-[rgba(91,133,167,0.30)] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(91,133,167,0.18)] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#F4F7FB]">{previewDoc.name}</h3>
                <p className="text-xs font-mono text-[#64748B]">
                  {previewDoc.type} · {formatFileSize(previewDoc.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg bg-[#05080D] text-[#94A3B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {previewDoc.dataUrl && previewDoc.type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDoc.dataUrl}
                alt={previewDoc.name}
                className="max-h-[65vh] mx-auto rounded-lg object-contain"
              />
            ) : previewDoc.dataUrl && previewDoc.type === 'application/pdf' ? (
              <iframe
                src={previewDoc.dataUrl}
                title={previewDoc.name}
                className="w-full h-[65vh] rounded-lg bg-white"
              />
            ) : (
              <div className="py-10 text-center text-xs text-[#94A3B8]">
                Preview unavailable for this format. Use Download to open locally.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Web3 Wallet Modal */}
      <WalletConnectModal
        open={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        detectedWallets={detectedWallets}
        connectedWallet={connectedWallet}
        connecting={walletConnecting}
        error={walletError}
        deepLinkPath="/dashboard?connectWallet=1"
        onSelectWallet={(wallet) => connectWithWallet(wallet)}
        onDisconnect={handleDisconnectWallet}
      />
    </div>
  );
}
