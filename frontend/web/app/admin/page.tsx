'use client';

import { useEffect, useState, useMemo, FormEvent } from 'react';
import {
  getLandListings,
  updateLandListing,
  deleteLandListing,
  addLandListing,
  getPurchaseOrders,
  savePurchaseOrders,
  getListingPriceUsd,
  getListingPriceToken,
  tokenToUsd,
  formatUsd,
  formatListingTokenPrice,
  formatTokenAmount,
  formatFileSize,
  NGN_PER_USD,
  type LandListing,
  type LandCategory,
  type LandDocument,
  type LandPurchaseOrder,
} from '@/lib/land-store';
import { useIntegratedToken } from '@/lib/use-integrated-token';
import {
  getUserAccountsWithStats,
  updateUserAccountStatus,
  deleteUserAccount,
  getRoleInviteCodes,
  generateRoleInviteCode,
  revokeRoleInviteCode,
  deleteRoleInviteCode,
  getRoleLabel,
  type UserAccountWithStats,
  type RoleInviteCode,
  type InviteCodeRole,
} from '@/lib/user-store';
import {
  ShieldCheck,
  Lock,
  Mail,
  LogOut,
  Layers,
  ShoppingBag,
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  Plus,
  Download,
  Eye,
  X,
  Users,
  CreditCard,
  Search,
  Ban,
  UserCheck,
  Phone,
  Wallet,
  Menu,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  CheckCheck,
  FileCode2,
  KeyRound,
  Copy,
  Check,
  Landmark,
} from 'lucide-react';
import { ContractRegistryPanel } from '@/components/web3/ContractRegistryPanel';

const ADMIN_SESSION_KEY = 'anagu_admin_authenticated_v1';

type AdminTab =
  | 'users'
  | 'access_codes'
  | 'registrations'
  | 'pending_queue'
  | 'marketplace'
  | 'orders'
  | 'contracts';

function downloadCsvFile(filename: string, rows: string[][]) {
  const escapeCell = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function StandaloneAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Admin Login Form
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Workspace & Sidebar State
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [listings, setListings] = useState<LandListing[]>([]);
  const [orders, setOrders] = useState<LandPurchaseOrder[]>([]);
  const [userStats, setUserStats] = useState<UserAccountWithStats[]>([]);
  const [inviteCodes, setInviteCodes] = useState<RoleInviteCode[]>([]);
  const { tokenInfo } = useIntegratedToken();

  // Role Access Code generator state
  const [codeRoleToGenerate, setCodeRoleToGenerate] = useState<InviteCodeRole>('registrar');
  const [codeRecipientNote, setCodeRecipientNote] = useState('');
  const [lastGeneratedCode, setLastGeneratedCode] = useState<RoleInviteCode | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState<'all' | 'active' | 'used' | 'revoked'>('all');

  // Filters & Inspection
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<
    'all' | 'with_lands' | 'with_payments' | 'suspended'
  >('all');
  const [inspectedUser, setInspectedUser] = useState<UserAccountWithStats | null>(null);

  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<
    'all' | 'pending_review' | 'approved' | 'rejected'
  >('all');
  const [regUserFilter, setRegUserFilter] = useState<string | null>(null);

  const [orderFilter, setOrderFilter] = useState<'all' | 'completed' | 'pending_settlement'>('all');

  const [previewDoc, setPreviewDoc] = useState<LandDocument | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Land Modal State
  const [newTitle, setNewTitle] = useState('');
  const [newState, setNewState] = useState('Lagos State');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<LandCategory>('Residential');
  const [newArea, setNewArea] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDocRef, setNewDocRef] = useState('');
  const [newOwner, setNewOwner] = useState('State Land Directorate');

  const notifyAction = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice((current) => (current === msg ? null : current));
    }, 3500);
  };

  const refreshData = () => {
    const nextListings = getLandListings();
    const nextOrders = getPurchaseOrders();
    const nextUsers = getUserAccountsWithStats();
    const nextCodes = getRoleInviteCodes();
    setListings(nextListings);
    setOrders(nextOrders);
    setUserStats(nextUsers);
    setInviteCodes(nextCodes);
    if (inspectedUser) {
      setInspectedUser(
        nextUsers.find((u) => u.account.id === inspectedUser.account.id) ?? null,
      );
    }
  };

  useEffect(() => {
    try {
      const authed = localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
      setAuthenticated(authed);
    } catch {
      setAuthenticated(false);
    }
    setListings(getLandListings());
    setOrders(getPurchaseOrders());
    setUserStats(getUserAccountsWithStats());
    setInviteCodes(getRoleInviteCodes());
    setCheckingAuth(false);

    const handleSync = () => {
      setListings(getLandListings());
      setOrders(getPurchaseOrders());
      setUserStats(getUserAccountsWithStats());
      setInviteCodes(getRoleInviteCodes());
    };
    window.addEventListener('anagu-codes-changed', handleSync);
    window.addEventListener('anagu-user-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('anagu-codes-changed', handleSync);
      window.removeEventListener('anagu-user-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !passcode.trim()) {
      setLoginError('Please enter admin email and passcode.');
      return;
    }

    if (
      (cleanEmail === 'admin@anagu.gov.ng' && passcode === 'admin123') ||
      passcode === 'AnaguAdmin@2026'
    ) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setAuthenticated(true);
      refreshData();
      return;
    }

    setLoginError('Invalid administrator credentials. Use admin@anagu.gov.ng / admin123.');
  };

  const handleQuickAdminAccess = () => {
    localStorage.setItem(ADMIN_SESSION_KEY, 'true');
    setAuthenticated(true);
    refreshData();
  };

  const handleSignOut = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthenticated(false);
    setSidebarOpen(false);
    setEmail('');
    setPasscode('');
  };

  const handleApproveAndList = (id: string) => {
    updateLandListing(id, {
      approvalStatus: 'approved',
      forSale: true,
      saleStatus: 'available',
    });
    refreshData();
    notifyAction('Land parcel approved and listed for sale.');
  };

  const handleApproveOnly = (id: string) => {
    updateLandListing(id, {
      approvalStatus: 'approved',
    });
    refreshData();
    notifyAction('Land parcel approved in registry.');
  };

  const handleReject = (id: string) => {
    updateLandListing(id, {
      approvalStatus: 'rejected',
      forSale: false,
    });
    refreshData();
    notifyAction('Land parcel marked as rejected.');
  };

  const handleToggleSaleStatus = (parcel: LandListing) => {
    const nextStatus = parcel.saleStatus === 'available' ? 'sold' : 'available';
    updateLandListing(parcel.id, {
      forSale: true,
      saleStatus: nextStatus,
    });
    refreshData();
  };

  const handleDeleteParcel = (id: string) => {
    deleteLandListing(id);
    refreshData();
    notifyAction('Land parcel removed from registry.');
  };

  const handleCompleteOrder = (orderId: string) => {
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, status: 'completed' as const } : o,
    );
    savePurchaseOrders(updated);
    refreshData();
    notifyAction(`Order ${orderId} marked as settled.`);
  };

  const handleToggleUserStatus = (userId: string, currentStatus: 'active' | 'suspended') => {
    updateUserAccountStatus(userId, currentStatus === 'active' ? 'suspended' : 'active');
    refreshData();
    notifyAction(
      currentStatus === 'active' ? 'User account suspended.' : 'User account reactivated.',
    );
  };

  const handleDeleteUserAccount = (userId: string) => {
    deleteUserAccount(userId);
    if (inspectedUser?.account.id === userId) {
      setInspectedUser(null);
    }
    refreshData();
    notifyAction('User account removed.');
  };

  const handleGenerateRoleCode = (e: FormEvent) => {
    e.preventDefault();
    const created = generateRoleInviteCode(codeRoleToGenerate, codeRecipientNote);
    setLastGeneratedCode(created);
    setCodeRecipientNote('');
    refreshData();
    notifyAction(
      `Generated ${created.role === 'governor' ? 'Governor' : 'Registrar'} code: ${created.code}`,
    );
  };

  const handleCopyCode = async (codeObj: RoleInviteCode) => {
    try {
      await navigator.clipboard.writeText(codeObj.code);
      setCopiedCodeId(codeObj.id);
      setTimeout(() => {
        setCopiedCodeId((curr) => (curr === codeObj.id ? null : curr));
      }, 2000);
      notifyAction(`Copied code ${codeObj.code}`);
    } catch {
      notifyAction(`Code: ${codeObj.code}`);
    }
  };

  const handleRevokeCode = (codeId: string) => {
    revokeRoleInviteCode(codeId);
    refreshData();
    notifyAction('Authorization code revoked.');
  };

  const handleDeleteCode = (codeId: string) => {
    deleteRoleInviteCode(codeId);
    if (lastGeneratedCode?.id === codeId) {
      setLastGeneratedCode(null);
    }
    refreshData();
    notifyAction('Authorization code deleted.');
  };

  const handleApproveAllForUser = (userLands: LandListing[]) => {
    for (const land of userLands) {
      if (land.approvalStatus === 'pending_review') {
        updateLandListing(land.id, {
          approvalStatus: 'approved',
          forSale: land.forSale,
          saleStatus: land.forSale ? (land.saleStatus === 'sold' ? 'sold' : 'available') : 'not_for_sale',
        });
      }
    }
    refreshData();
    notifyAction('Pending lands for user approved.');
  };

  const handleApproveAllPending = () => {
    const pending = listings.filter((l) => l.approvalStatus === 'pending_review');
    if (pending.length === 0) {
      notifyAction('No pending land registrations awaiting approval.');
      return;
    }
    for (const land of pending) {
      updateLandListing(land.id, {
        approvalStatus: 'approved',
        forSale: land.forSale,
        saleStatus: land.forSale ? (land.saleStatus === 'sold' ? 'sold' : 'available') : 'not_for_sale',
      });
    }
    refreshData();
    setSidebarOpen(false);
    notifyAction(`Approved ${pending.length} pending land registrations.`);
  };

  const handleExportLandsCsv = () => {
    const header = [
      'Parcel Ref',
      'Title',
      'Owner',
      'Email',
      'Phone',
      'State',
      'Location',
      'Category',
      'Area (sqm)',
      'Price (USD)',
      'Approval Status',
      'Sale Status',
      'Documents',
    ];
    const rows = listings.map((l) => [
      l.parcelRef,
      l.title,
      l.ownerName,
      l.ownerEmail,
      l.ownerPhone,
      l.state,
      l.location,
      l.category,
      String(l.areaSqm),
      String(getListingPriceUsd(l)),
      l.approvalStatus,
      l.saleStatus,
      String(l.documents.length),
    ]);
    downloadCsvFile(`anagu-lands-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
    setSidebarOpen(false);
    notifyAction('Exported registered lands CSV.');
  };

  const handleExportUsersCsv = () => {
    const header = [
      'Account ID',
      'Full Name',
      'Email',
      'Phone',
      'Status',
      'Total Lands',
      'Approved Lands',
      'Pending Lands',
      'Sold Lands',
      'Documents Uploaded',
      'Completed Payments',
      'Total Paid (USD)',
    ];
    const rows = userStats.map((u) => [
      u.account.id,
      u.account.fullName,
      u.account.email,
      u.account.phone,
      u.account.status,
      String(u.totalLands),
      String(u.approvedLands),
      String(u.pendingLands),
      String(u.soldLands),
      String(u.totalDocuments),
      String(u.completedPaymentsCount),
      String(u.totalPaidUsd),
    ]);
    downloadCsvFile(`anagu-users-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
    setSidebarOpen(false);
    notifyAction('Exported user accounts CSV.');
  };

  const handleCreateAdminParcel = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim()) return;

    const parsedTokens = Number(newPrice);
    const priceToken = Number.isFinite(parsedTokens) && parsedTokens > 0 ? parsedTokens : 50000;
    const priceUsd = tokenToUsd(priceToken);

    addLandListing({
      title: newTitle.trim(),
      ownerName: newOwner.trim() || 'Registry Administration',
      ownerEmail: 'admin@anagu.gov.ng',
      ownerPhone: '+234 800 100 2000',
      state: newState,
      location: newLocation.trim(),
      areaSqm: Number(newArea) || 1000,
      category: newCategory,
      documentType: 'Certificate of Occupancy (C of O)',
      documentNumber: newDocRef.trim() || `ADM/COFO/${Date.now().toString().slice(-4)}`,
      priceToken,
      tokenSymbol: tokenInfo.symbol,
      priceUsd,
      priceNgn: priceUsd * NGN_PER_USD,
      forSale: true,
      saleStatus: 'available',
      approvalStatus: 'approved',
      description: `Verified parcel published directly by Registry Administration in ${newLocation.trim()}, ${newState}.`,
      coordinates: 'Surveyed Official Parcel',
      documents: [
        {
          id: `DOC-ADM-${Date.now()}`,
          name: 'Official_Registry_Certificate.pdf',
          size: 1240000,
          type: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ],
    });

    refreshData();
    setShowAddModal(false);
    setNewTitle('');
    setNewLocation('');
    setNewArea('');
    setNewPrice('');
    setNewDocRef('');
    notifyAction('Published new land listing to Explore Land.');
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return userStats.filter((item) => {
      if (userFilter === 'with_lands' && item.totalLands === 0) return false;
      if (userFilter === 'with_payments' && item.buyerOrders.length === 0) return false;
      if (userFilter === 'suspended' && item.account.status !== 'suspended') return false;
      if (!q) return true;
      return (
        item.account.fullName.toLowerCase().includes(q) ||
        item.account.email.toLowerCase().includes(q) ||
        item.account.phone.toLowerCase().includes(q) ||
        item.account.id.toLowerCase().includes(q)
      );
    });
  }, [userStats, userSearch, userFilter]);

  const filteredRegistrations = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    const effectiveStatus = activeTab === 'pending_queue' ? 'pending_review' : regStatusFilter;
    return listings.filter((parcel) => {
      if (effectiveStatus !== 'all' && parcel.approvalStatus !== effectiveStatus) return false;
      if (regUserFilter) {
        const targetUser = userStats.find((u) => u.account.id === regUserFilter);
        if (targetUser && !targetUser.lands.some((l) => l.id === parcel.id)) {
          return false;
        }
      }
      if (!q) return true;
      return (
        parcel.title.toLowerCase().includes(q) ||
        parcel.parcelRef.toLowerCase().includes(q) ||
        parcel.ownerName.toLowerCase().includes(q) ||
        parcel.ownerEmail.toLowerCase().includes(q) ||
        parcel.location.toLowerCase().includes(q) ||
        parcel.state.toLowerCase().includes(q)
      );
    });
  }, [listings, regSearch, regStatusFilter, regUserFilter, userStats, activeTab]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#070B12] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </main>
    );
  }

  // Standalone Admin Gate (completely separate from the main public/user site)
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#070B12] text-[#F1F5F9] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl bg-[#0F172A] border border-slate-800 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-800">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Registry Admin Console
              </h1>
              <p className="text-xs text-slate-400">
                Restricted Land Administration Portal
              </p>
            </div>
          </div>

          {loginError && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-rose-950/40 border border-rose-500/40 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs text-slate-400 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@anagu.gov.ng"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070B12] border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-passcode" className="block text-xs text-slate-400 mb-1.5">
                Admin Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="admin-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070B12] border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] font-mono text-slate-500">
                Demo credentials: admin@anagu.gov.ng / admin123
              </p>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors"
            >
              Sign In to Admin Console
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleQuickAdminAccess}
              className="w-full h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              Quick Admin Access (Demo)
            </button>
          </div>
        </div>
      </main>
    );
  }

  const usersWhoUploadedCount = userStats.filter((u) => u.totalLands > 0).length;
  const approvedCount = listings.filter((l) => l.approvalStatus === 'approved').length;
  const pendingCount = listings.filter((l) => l.approvalStatus === 'pending_review').length;
  const forSaleCount = listings.filter((l) => l.forSale && l.saleStatus === 'available').length;

  const paidOrders = orders.filter((o) => o.status === 'completed');
  const pendingOrders = orders.filter((o) => o.status !== 'completed');
  const totalPaidUsd = paidOrders.reduce((sum, o) => sum + getListingPriceUsd(o), 0);
  const totalPaidToken = paidOrders.reduce((sum, o) => sum + getListingPriceToken(o), 0);

  const activeCodesCount = inviteCodes.filter((c) => c.status === 'active').length;

  const tabLabels: Record<AdminTab, string> = {
    users: 'User Accounts',
    access_codes: 'Registrar & Governor Codes',
    registrations: 'Registered Lands',
    pending_queue: 'Pending Review',
    marketplace: 'For Sale Inventory',
    orders: 'Payments & Settlement',
    contracts: 'Smart Contracts (ethers.js)',
  };

  const navItems: Array<{
    id: AdminTab;
    label: string;
    count: string | number;
    icon: typeof Users;
    toneClass?: string;
  }> = [
    {
      id: 'users',
      label: 'User Accounts',
      count: userStats.length,
      icon: Users,
    },
    {
      id: 'access_codes',
      label: 'Role Access Codes',
      count: activeCodesCount,
      icon: KeyRound,
      toneClass: 'text-amber-400',
    },
    {
      id: 'registrations',
      label: 'Registered Lands',
      count: listings.length,
      icon: Layers,
    },
    {
      id: 'pending_queue',
      label: 'Pending Review',
      count: pendingCount,
      icon: Clock,
      toneClass: 'text-amber-400',
    },
    {
      id: 'marketplace',
      label: 'For Sale Inventory',
      count: forSaleCount,
      icon: ShoppingBag,
      toneClass: 'text-emerald-400',
    },
    {
      id: 'orders',
      label: 'Payments & Orders',
      count: `${paidOrders.length}/${orders.length}`,
      icon: CreditCard,
      toneClass: 'text-sky-400',
    },
    {
      id: 'contracts',
      label: 'Smart Contracts',
      count: 3,
      icon: FileCode2,
      toneClass: 'text-indigo-400',
    },
  ];

  const selectAdminTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === 'registrations') {
      setRegStatusFilter('all');
    } else if (tab === 'pending_queue') {
      setRegStatusFilter('pending_review');
    }
    setSidebarOpen(false);
  };

  const renderAdminSidebar = () => (
    <div className="flex flex-col h-full">
      {/* Admin Brand */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-sm font-bold tracking-tight text-white">
              Anagu Admin
            </span>
            <span className="block text-[11px] text-slate-400">Land Directorate</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
          aria-label="Close admin sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sidebar Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {/* Management Views */}
        <div className="space-y-1">
          <p className="px-3 pb-1.5 text-[11px] font-medium text-slate-500">
            Management
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectAdminTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-500/15 text-white border border-indigo-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : item.toneClass ?? 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    isActive ? 'text-indigo-300' : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selectable Admin Actions */}
        <div className="space-y-1.5 pt-4 border-t border-slate-800">
          <p className="px-3 pb-1 text-[11px] font-medium text-slate-500">
            Admin Actions
          </p>
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Land Listing</span>
          </button>

          <button
            type="button"
            onClick={handleApproveAllPending}
            disabled={pendingCount === 0}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[#0F172A] border border-slate-800 hover:border-emerald-500/40 text-xs font-medium text-emerald-300 disabled:opacity-45 disabled:hover:border-slate-800 transition-colors whitespace-nowrap"
          >
            <span className="flex items-center gap-2.5">
              <CheckCheck className="h-4 w-4 shrink-0" />
              <span>Approve All Pending</span>
            </span>
            <span className="font-mono tabular-nums text-[11px]">{pendingCount}</span>
          </button>

          <button
            type="button"
            onClick={handleExportLandsCsv}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/70 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-indigo-400" />
            <span>Export Lands CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportUsersCsv}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/70 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4 shrink-0 text-sky-400" />
            <span>Export Users CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              refreshData();
              setSidebarOpen(false);
              notifyAction('Registry records refreshed.');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4 shrink-0 text-slate-400" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Admin Session Footer */}
      <div className="p-4 border-t border-slate-800 space-y-3 bg-[#070B12] shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">Registry Administrator</p>
          <p className="text-[11px] font-mono text-slate-500 truncate">admin@anagu.gov.ng</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070B12] text-[#F1F5F9] flex">
      {/* Desktop Fixed Admin Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 xl:w-72 lg:shrink-0 border-r border-slate-800 bg-[#0B1120] sticky top-0 h-screen">
        {renderAdminSidebar()}
      </aside>

      {/* Mobile Slide-Over Admin Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#0B1120] border-r border-slate-800 flex flex-col">
            {renderAdminSidebar()}
          </aside>
        </div>
      )}

      {/* Main Admin Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-[#070B12]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] border border-slate-800 text-slate-300 hover:text-white shrink-0"
              aria-label="Open admin sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline">Admin Console</span>
              <span className="text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-semibold text-white truncate">
                {tabLabels[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {actionNotice && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {actionNotice}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Land</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 space-y-7 max-w-6xl w-full mx-auto">
          {actionNotice && (
            <div className="md:hidden rounded-lg bg-emerald-950/40 border border-emerald-500/40 px-3.5 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* KPI Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => selectAdminTab('users')}
              className={`text-left rounded-xl bg-[#0F172A] border p-5 transition-colors ${
                activeTab === 'users'
                  ? 'border-indigo-400/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-400">User Accounts</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
                {userStats.length}
              </p>
              <p className="mt-1 text-[11px] font-mono text-indigo-300">
                {usersWhoUploadedCount} users uploaded lands
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectAdminTab('registrations')}
              className={`text-left rounded-xl bg-[#0F172A] border p-5 transition-colors ${
                activeTab === 'registrations'
                  ? 'border-indigo-400/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-400">Total Registered Lands</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
                {listings.length}
              </p>
              <p className="mt-1 text-[11px] font-mono text-emerald-400">
                {approvedCount} approved · {pendingCount} pending
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectAdminTab('pending_queue')}
              className={`text-left rounded-xl bg-[#0F172A] border p-5 transition-colors ${
                activeTab === 'pending_queue'
                  ? 'border-amber-400/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-400">Pending Uploads / Review</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-400">
                {pendingCount}
              </p>
              <p className="mt-1 text-[11px] font-mono text-slate-400">
                Awaiting verification
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectAdminTab('orders')}
              className={`text-left rounded-xl bg-[#0F172A] border p-5 transition-colors ${
                activeTab === 'orders'
                  ? 'border-emerald-400/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs text-slate-400">Payments Made (Settled)</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {paidOrders.length}{' '}
                <span className="text-sm font-normal text-sky-300">
                  ({formatTokenAmount(totalPaidToken, tokenInfo.symbol)})
                </span>
              </p>
              <p className="mt-1 text-[11px] font-mono text-amber-300">
                {pendingOrders.length} pending settlement
              </p>
            </button>
          </div>

          {/* TAB 1: User Accounts Management */}
          {activeTab === 'users' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-400" />
                  <span>All User Accounts &amp; Uploaded Lands</span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search user name, email, phone..."
                      className="h-9 pl-8 pr-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none w-56"
                    />
                  </div>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value as typeof userFilter)}
                    className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="all">All Accounts ({userStats.length})</option>
                    <option value="with_lands">Uploaded Lands ({usersWhoUploadedCount})</option>
                    <option value="with_payments">
                      Made Payments ({userStats.filter((u) => u.buyerOrders.length > 0).length})
                    </option>
                    <option value="suspended">
                      Suspended ({userStats.filter((u) => u.account.status === 'suspended').length})
                    </option>
                  </select>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-10 text-center text-sm text-slate-400">
                  No user accounts match the current filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((item) => {
                    const { account } = item;
                    return (
                      <div
                        key={account.id}
                        className="rounded-xl bg-[#0F172A] border border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span className="text-indigo-400">{account.id}</span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                account.role === 'governor'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                  : account.role === 'registrar'
                                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {getRoleLabel(account.role)}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span
                              className={
                                account.status === 'active'
                                  ? 'text-emerald-400 font-medium'
                                  : 'text-rose-400 font-medium'
                              }
                            >
                              {account.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span className="text-slate-500 tabular-nums">
                              Joined {new Date(account.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <h3 className="text-base font-semibold text-white">
                            {account.fullName}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-slate-500" />
                              {account.email}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-slate-500" />
                              {account.phone}
                            </span>
                            {account.walletAddress && (
                              <span className="inline-flex items-center gap-1 font-mono text-indigo-300">
                                <Wallet className="h-3.5 w-3.5" />
                                {account.walletAddress.slice(0, 6)}…{account.walletAddress.slice(-4)}
                              </span>
                            )}
                          </div>

                          {/* User Lands & Payments Metrics */}
                          <div className="pt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-300">
                            <span className="text-white font-semibold">
                              {item.totalLands} {item.totalLands === 1 ? 'Land' : 'Lands'}
                            </span>
                            {item.approvedLands > 0 && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">·</span>
                                <span className="text-emerald-400">{item.approvedLands} Approved</span>
                              </>
                            )}
                            {item.pendingLands > 0 && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">·</span>
                                <span className="text-amber-400">{item.pendingLands} Pending</span>
                              </>
                            )}
                            {item.soldLands > 0 && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">·</span>
                                <span className="text-indigo-300">{item.soldLands} Sold</span>
                              </>
                            )}
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span className="text-slate-400">{item.totalDocuments} Docs</span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span
                              className={
                                item.completedPaymentsCount > 0
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {item.completedPaymentsCount} Paid ({formatUsd(item.totalPaidUsd)})
                              {item.pendingPaymentsCount > 0
                                ? ` · ${item.pendingPaymentsCount} Pending`
                                : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectedUser(item)}
                            className="h-9 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect Account</span>
                          </button>
                          {item.pendingLands > 0 && (
                            <button
                              type="button"
                              onClick={() => handleApproveAllForUser(item.lands)}
                              className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Approve All ({item.pendingLands})</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(account.id, account.status)}
                            className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                              account.status === 'active'
                                ? 'bg-slate-800 hover:bg-amber-950/50 border-slate-700 text-amber-300'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            {account.status === 'active' ? (
                              <>
                                <Ban className="h-3.5 w-3.5" />
                                <span>Suspend</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Reactivate</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUserAccount(account.id)}
                            className="h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
                            aria-label={`Delete ${account.fullName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2 & 3: Land Registrations / Pending Queue & Uploaded Documents */}
          {(activeTab === 'registrations' || activeTab === 'pending_queue') && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    <span>
                      {activeTab === 'pending_queue'
                        ? `Pending Verification Queue (${filteredRegistrations.length})`
                        : 'Registered Lands & Uploaded Documents'}
                    </span>
                  </h2>
                  {regUserFilter && (
                    <button
                      type="button"
                      onClick={() => setRegUserFilter(null)}
                      className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono inline-flex items-center gap-1"
                    >
                      <span>Filtered by User</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={regSearch}
                      onChange={(e) => setRegSearch(e.target.value)}
                      placeholder="Search parcel, owner, location..."
                      className="h-9 pl-8 pr-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none w-56"
                    />
                  </div>
                  {activeTab === 'registrations' && (
                    <select
                      value={regStatusFilter}
                      onChange={(e) => setRegStatusFilter(e.target.value as typeof regStatusFilter)}
                      className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="all">All Statuses ({listings.length})</option>
                      <option value="pending_review">Pending Review ({pendingCount})</option>
                      <option value="approved">Approved ({approvedCount})</option>
                      <option value="rejected">
                        Rejected ({listings.filter((l) => l.approvalStatus === 'rejected').length})
                      </option>
                    </select>
                  )}
                </div>
              </div>

              {filteredRegistrations.length === 0 ? (
                <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-10 text-center text-sm text-slate-400">
                  No land registrations match the current filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRegistrations.map((parcel) => (
                    <div
                      key={parcel.id}
                      className="rounded-xl bg-[#0F172A] border border-slate-800 p-5 space-y-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span className="text-indigo-400">{parcel.parcelRef}</span>
                            <span className="text-slate-600">·</span>
                            <span
                              className={
                                parcel.approvalStatus === 'approved'
                                  ? 'text-emerald-400'
                                  : parcel.approvalStatus === 'rejected'
                                    ? 'text-rose-400'
                                    : 'text-amber-400'
                              }
                            >
                              {parcel.approvalStatus === 'approved'
                                ? 'Approved'
                                : parcel.approvalStatus === 'rejected'
                                  ? 'Rejected'
                                  : 'Pending Review'}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">
                              {parcel.forSale
                                ? parcel.saleStatus === 'sold'
                                  ? `Sold (${formatListingTokenPrice(parcel, tokenInfo.symbol)} · ≈ ${formatUsd(getListingPriceUsd(parcel))})`
                                  : `For Sale (${formatListingTokenPrice(parcel, tokenInfo.symbol)} · ≈ ${formatUsd(getListingPriceUsd(parcel))})`
                                : 'Not Listed for Sale'}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-white mt-1">
                            {parcel.title}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {parcel.location}, {parcel.state} · {parcel.areaSqm.toLocaleString()} sqm ·{' '}
                            {parcel.documentType} ({parcel.documentNumber})
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Owner: <span className="text-slate-300">{parcel.ownerName}</span> ({parcel.ownerEmail} · {parcel.ownerPhone})
                            {parcel.ownerWalletAddress && (
                              <span className="ml-2 font-mono text-indigo-300">
                                · {tokenInfo.symbol} Wallet: {parcel.ownerWalletAddress.slice(0, 6)}…{parcel.ownerWalletAddress.slice(-4)}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApproveAndList(parcel.id)}
                            className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve &amp; List</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveOnly(parcel.id)}
                            className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium whitespace-nowrap"
                          >
                            Approve Only
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(parcel.id)}
                            className="h-9 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParcel(parcel.id)}
                            className="h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition-colors"
                            aria-label={`Delete ${parcel.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Uploaded Documents */}
                      <div className="pt-3 border-t border-slate-800">
                        <p className="text-xs text-slate-400 mb-2">
                          Submitted Documents ({parcel.documents.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {parcel.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#070B12] border border-slate-800 text-xs"
                            >
                              <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                              <span className="text-slate-200 max-w-[200px] truncate">{doc.name}</span>
                              <span className="text-slate-500 font-mono">{formatFileSize(doc.size)}</span>
                              {doc.dataUrl && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc(doc)}
                                    className="text-indigo-400 hover:text-indigo-300 p-1"
                                    title="Preview document"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <a
                                    href={doc.dataUrl}
                                    download={doc.name}
                                    className="text-emerald-400 hover:text-emerald-300 p-1"
                                    title="Download document"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 4: For Sale Marketplace Management */}
          {activeTab === 'marketplace' && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-white">
                Lands Out for Sale (Marketplace Inventory)
              </h2>

              <div className="overflow-x-auto rounded-xl bg-[#0F172A] border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="bg-[#0B1120]">
                    <tr>
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Parcel</th>
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Location</th>
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Size</th>
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Price</th>
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Status</th>
                      <th className="px-5 py-3.5 text-right font-mono uppercase text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {listings
                      .filter((item) => item.forSale)
                      .map((parcel) => (
                        <tr key={parcel.id} className="hover:bg-slate-800/40">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-white">{parcel.title}</p>
                            <p className="font-mono text-indigo-400 mt-0.5">{parcel.parcelRef}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {parcel.location}, {parcel.state}
                          </td>
                          <td className="px-5 py-4 font-mono tabular-nums text-slate-300">
                            {parcel.areaSqm.toLocaleString()} sqm
                          </td>
                          <td className="px-5 py-4 font-mono tabular-nums text-sky-300 font-semibold">
                            <p>{formatListingTokenPrice(parcel, tokenInfo.symbol)}</p>
                            <p className="text-[11px] font-normal text-slate-400">
                              ≈ {formatUsd(getListingPriceUsd(parcel))}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`font-mono font-semibold ${
                                parcel.saleStatus === 'sold' ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {parcel.saleStatus === 'sold' ? 'Sold' : 'Available'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleSaleStatus(parcel)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium whitespace-nowrap"
                            >
                              {parcel.saleStatus === 'sold' ? 'Mark Available' : 'Mark Sold'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 5: Payments & Purchase Orders */}
          {activeTab === 'orders' && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-400" />
                    <span>Payments &amp; Buyer Purchase Orders</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                    {paidOrders.length} payments completed (
                    {formatTokenAmount(totalPaidToken, tokenInfo.symbol)} · ≈{' '}
                    {formatUsd(totalPaidUsd)}) · {pendingOrders.length} pending settlement
                  </p>
                </div>

                <div className="inline-flex rounded-lg bg-[#0F172A] border border-slate-800 p-1">
                  {(
                    [
                      { id: 'all', label: `All (${orders.length})` },
                      { id: 'completed', label: `Payments Made (${paidOrders.length})` },
                      { id: 'pending_settlement', label: `Pending (${pendingOrders.length})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOrderFilter(f.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        orderFilter === f.id
                          ? 'bg-indigo-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-10 text-center text-sm text-slate-400">
                  No orders match the selected payment filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl bg-[#0F172A] border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead className="bg-[#0B1120]">
                      <tr>
                        <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Order ID</th>
                        <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Buyer</th>
                        <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Parcel</th>
                        <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Amount</th>
                        <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Payment / Settlement</th>
                        <th className="px-5 py-3.5 text-right font-mono uppercase text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/40">
                          <td className="px-5 py-4 font-mono text-indigo-400">{order.id}</td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-white">{order.buyerName}</p>
                            <p className="text-slate-400">
                              {order.buyerEmail} · {order.buyerPhone}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-white">{order.landTitle}</p>
                            <p className="font-mono text-slate-400">{order.parcelRef}</p>
                          </td>
                          <td className="px-5 py-4 font-mono tabular-nums text-sky-300 font-semibold">
                            <p>
                              {order.tokenAmountPaid
                                ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
                                : formatListingTokenPrice(
                                    order,
                                    order.tokenSymbol || tokenInfo.symbol,
                                  )}
                            </p>
                            <p className="text-[11px] font-normal text-slate-400">
                              ≈ {formatUsd(getListingPriceUsd(order))}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-slate-300">{order.paymentMethod}</p>
                            {order.walletAddress && (
                              <p className="font-mono text-[11px] text-indigo-300 mt-0.5">
                                {order.walletName ? `${order.walletName}: ` : ''}
                                {order.walletAddress.slice(0, 6)}…{order.walletAddress.slice(-4)}
                              </p>
                            )}
                            {order.walletTxHash && (
                              <p className="font-mono text-[11px] text-emerald-400 mt-0.5">
                                Tx: {order.walletTxHash.slice(0, 10)}…{order.walletTxHash.slice(-6)}
                              </p>
                            )}
                            <p
                              className={`font-mono mt-0.5 ${
                                order.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {order.status === 'completed' ? 'Payment Made (Settled)' : 'Pending Settlement'}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {order.status !== 'completed' ? (
                              <button
                                type="button"
                                onClick={() => handleCompleteOrder(order.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium whitespace-nowrap"
                              >
                                Mark Payment Made
                              </button>
                            ) : (
                              <span className="text-emerald-400 font-mono inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Paid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB 2B: Registrar & Governor Registration Access Codes */}
          {activeTab === 'access_codes' && (
            <section className="space-y-6">
              <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-amber-400" />
                      <span>Generate Registrar &amp; Governor Registration Codes</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Generate a strict single-use authorization code for an official to register as a Registrar or Governor. Each code creates only one account and automatically expires immediately after use. Without an active code, users can only register as Normal Users.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleGenerateRoleCode} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-2">
                        Target Account Role *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCodeRoleToGenerate('registrar')}
                          className={`h-11 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                            codeRoleToGenerate === 'registrar'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                              : 'bg-[#070B12] border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Registrar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodeRoleToGenerate('governor')}
                          className={`h-11 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                            codeRoleToGenerate === 'governor'
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-[#070B12] border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Landmark className="h-4 w-4" />
                          <span>Governor</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="code-note" className="block text-xs text-slate-400 mb-2">
                        Recipient Name / Bureau Note (Optional)
                      </label>
                      <input
                        id="code-note"
                        type="text"
                        value={codeRecipientNote}
                        onChange={(e) => setCodeRecipientNote(e.target.value)}
                        placeholder={
                          codeRoleToGenerate === 'governor'
                            ? 'e.g. Executive Governor Office — Lagos State'
                            : 'e.g. Barr. Fatimah Aliyu — Deeds Registry'
                        }
                        className="w-full h-11 px-3.5 rounded-lg bg-[#070B12] border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="h-10 px-5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>
                        Generate{' '}
                        {codeRoleToGenerate === 'governor' ? 'Governor' : 'Registrar'} Code
                      </span>
                    </button>
                  </div>
                </form>

                {lastGeneratedCode && (
                  <div className="rounded-xl bg-[#070B12] border border-emerald-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                        New{' '}
                        {lastGeneratedCode.role === 'governor' ? 'Governor' : 'Registrar'}{' '}
                        Code Ready to Share
                      </p>
                      <p className="text-xl font-bold font-mono tracking-wider text-white">
                        {lastGeneratedCode.code}
                      </p>
                      {lastGeneratedCode.recipientNote && (
                        <p className="text-xs text-slate-400">
                          Assigned Note: {lastGeneratedCode.recipientNote}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode(lastGeneratedCode)}
                      className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0"
                    >
                      {copiedCodeId === lastGeneratedCode.id ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Issued Codes History */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">
                    Issued Authorization Codes ({inviteCodes.length})
                  </h3>
                  <select
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value as typeof codeFilter)}
                    className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="all">All Codes ({inviteCodes.length})</option>
                    <option value="active">
                      Active ({inviteCodes.filter((c) => c.status === 'active').length})
                    </option>
                    <option value="used">
                      Expired / Used ({inviteCodes.filter((c) => c.status === 'used').length})
                    </option>
                    <option value="revoked">
                      Revoked ({inviteCodes.filter((c) => c.status === 'revoked').length})
                    </option>
                  </select>
                </div>

                {inviteCodes.filter((c) => codeFilter === 'all' || c.status === codeFilter).length ===
                0 ? (
                  <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-10 text-center text-sm text-slate-400">
                    No authorization codes generated yet. Use the form above to generate a Registrar or Governor registration code.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {inviteCodes
                      .filter((c) => codeFilter === 'all' || c.status === codeFilter)
                      .map((codeItem) => (
                        <div
                          key={codeItem.id}
                          className="rounded-xl bg-[#0F172A] border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                              <span className="text-sm font-bold text-white tracking-wider">
                                {codeItem.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  codeItem.role === 'governor'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                    : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                                }`}
                              >
                                {codeItem.role === 'governor' ? 'Governor' : 'Registrar'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  codeItem.status === 'active'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                    : codeItem.status === 'used'
                                      ? 'bg-slate-700/40 text-slate-300 border-slate-600'
                                      : 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                                }`}
                              >
                                {codeItem.status === 'used'
                                  ? 'EXPIRED (1/1 USED)'
                                  : codeItem.status.toUpperCase()}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span>
                                Created {new Date(codeItem.createdAt).toLocaleString()}
                              </span>
                              {codeItem.recipientNote && (
                                <span className="text-slate-300">
                                  Note: {codeItem.recipientNote}
                                </span>
                              )}
                              {codeItem.status === 'used' && codeItem.usedByName && (
                                <span className="text-indigo-300 font-mono">
                                  Used &amp; expired by {codeItem.usedByName} ({codeItem.usedByEmail})
                                  {codeItem.usedAt
                                    ? ` · ${new Date(codeItem.usedAt).toLocaleString()}`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleCopyCode(codeItem)}
                              className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5"
                            >
                              {copiedCodeId === codeItem.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            {codeItem.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleRevokeCode(codeItem.id)}
                                className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-amber-950/50 border border-slate-700 text-amber-300 text-xs font-medium inline-flex items-center gap-1.5"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>Revoke</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteCode(codeItem.id)}
                              className="h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-colors"
                              aria-label={`Delete code ${codeItem.code}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 6: Smart Contracts Registry & Verification */}
          {activeTab === 'contracts' && (
            <section className="space-y-4">
              <ContractRegistryPanel />
            </section>
          )}
        </main>
      </div>

      {/* User Account Inspector Modal */}
      {inspectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#0F172A] border border-slate-700 p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="text-indigo-400">{inspectedUser.account.id}</span>
                  <span className="text-slate-600">·</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      inspectedUser.account.role === 'governor'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : inspectedUser.account.role === 'registrar'
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {getRoleLabel(inspectedUser.account.role)}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span
                    className={
                      inspectedUser.account.status === 'active'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }
                  >
                    {inspectedUser.account.status.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {inspectedUser.account.fullName}
                </h3>
                <p className="text-xs text-slate-400">
                  {inspectedUser.account.email} · {inspectedUser.account.phone}
                  {inspectedUser.account.inviteCodeUsed
                    ? ` · Registered with code ${inspectedUser.account.inviteCodeUsed}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-[#070B12] border border-slate-800 p-3">
                <p className="text-slate-400">Lands Uploaded</p>
                <p className="text-lg font-bold font-mono tabular-nums text-white mt-0.5">
                  {inspectedUser.totalLands}
                </p>
              </div>
              <div className="rounded-lg bg-[#070B12] border border-slate-800 p-3">
                <p className="text-slate-400">Approved / Pending</p>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
                  {inspectedUser.approvedLands}{' '}
                  <span className="text-amber-400 text-sm">/ {inspectedUser.pendingLands}</span>
                </p>
              </div>
              <div className="rounded-lg bg-[#070B12] border border-slate-800 p-3">
                <p className="text-slate-400">Documents</p>
                <p className="text-lg font-bold font-mono tabular-nums text-indigo-300 mt-0.5">
                  {inspectedUser.totalDocuments}
                </p>
              </div>
              <div className="rounded-lg bg-[#070B12] border border-slate-800 p-3">
                <p className="text-slate-400">Payments Made</p>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-0.5">
                  {inspectedUser.completedPaymentsCount} ({formatUsd(inspectedUser.totalPaidUsd)})
                </p>
              </div>
            </div>

            {/* Lands Registered by This User */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Lands Registered by User ({inspectedUser.lands.length})
                </h4>
                {inspectedUser.lands.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegUserFilter(inspectedUser.account.id);
                      setInspectedUser(null);
                      selectAdminTab('registrations');
                    }}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Open in Land Registrations →
                  </button>
                )}
              </div>

              {inspectedUser.lands.length === 0 ? (
                <p className="text-xs text-slate-500">No lands uploaded by this user.</p>
              ) : (
                <div className="space-y-2">
                  {inspectedUser.lands.map((land) => (
                    <div
                      key={land.id}
                      className="rounded-lg bg-[#070B12] border border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-mono text-indigo-400">{land.parcelRef}</p>
                        <p className="font-semibold text-white mt-0.5">{land.title}</p>
                        <p className="text-slate-400">
                          {land.location}, {land.state} · {land.areaSqm.toLocaleString()} sqm ·{' '}
                          {land.documents.length} docs
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono ${
                            land.approvalStatus === 'approved'
                              ? 'text-emerald-400'
                              : land.approvalStatus === 'rejected'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                          }`}
                        >
                          {land.approvalStatus}
                        </span>
                        {land.approvalStatus === 'pending_review' && (
                          <button
                            type="button"
                            onClick={() => handleApproveAndList(land.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          >
                            Approve &amp; List
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments Made by This User */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Payments &amp; Purchase Orders ({inspectedUser.buyerOrders.length})
              </h4>
              {inspectedUser.buyerOrders.length === 0 ? (
                <p className="text-xs text-slate-500">No payments made by this user yet.</p>
              ) : (
                <div className="space-y-2">
                  {inspectedUser.buyerOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-lg bg-[#070B12] border border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-mono text-indigo-400">
                          {order.id} · {order.parcelRef}
                        </p>
                        <p className="font-semibold text-white mt-0.5">{order.landTitle}</p>
                        <p className="text-slate-400">
                          {order.paymentMethod} ·{' '}
                          <span className="font-mono text-sky-300">
                            {order.tokenAmountPaid
                              ? `${order.tokenAmountPaid} ${order.tokenSymbol || tokenInfo.symbol}`
                              : formatListingTokenPrice(
                                  order,
                                  order.tokenSymbol || tokenInfo.symbol,
                                )}
                          </span>{' '}
                          (≈ {formatUsd(getListingPriceUsd(order))})
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono ${
                            order.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {order.status === 'completed' ? 'Payment Made' : 'Pending Settlement'}
                        </span>
                        {order.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleCompleteOrder(order.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl bg-[#0F172A] border border-slate-700 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{previewDoc.name}</h3>
                <p className="text-xs font-mono text-slate-400">
                  {previewDoc.type} · {formatFileSize(previewDoc.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
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
              <div className="py-12 text-center space-y-3">
                <FileText className="mx-auto h-10 w-10 text-indigo-400" />
                <p className="text-sm text-slate-300">
                  Preview unavailable for this file format ({previewDoc.type}).
                </p>
                {previewDoc.dataUrl && (
                  <a
                    href={previewDoc.dataUrl}
                    download={previewDoc.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download File</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Land Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl bg-[#0F172A] border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">Add Land Listing</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminParcel} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Parcel Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Victoria Island Commercial Plot 9"
                  className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">State</label>
                  <input
                    type="text"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as LandCategory)}
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Agricultural">Agricultural</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Mixed-Use">Mixed-Use</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Location Address *</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Street, District, LGA"
                  className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Size (sqm)</label>
                  <input
                    type="number"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="1200"
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Price ({tokenInfo.symbol} Token)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="75000"
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Document Ref</label>
                  <input
                    type="text"
                    value={newDocRef}
                    onChange={(e) => setNewDocRef(e.target.value)}
                    placeholder="LASG/2026/001"
                    className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold"
                >
                  Publish to Explore Land
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
