'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  getLandListings,
  updateLandListing,
  deleteLandListing,
  addLandListing,
  getPurchaseOrders,
  savePurchaseOrders,
  getListingPriceUsd,
  formatUsd,
  formatEthFromUsd,
  formatFileSize,
  NGN_PER_USD,
  type LandListing,
  type LandCategory,
  type LandDocument,
  type LandPurchaseOrder,
} from '@/lib/land-store';
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
} from 'lucide-react';

const ADMIN_SESSION_KEY = 'anagu_admin_authenticated_v1';

export default function StandaloneAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Admin Login Form
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Workspace State
  const [activeTab, setActiveTab] = useState<'registrations' | 'marketplace' | 'orders'>(
    'registrations',
  );
  const [listings, setListings] = useState<LandListing[]>([]);
  const [orders, setOrders] = useState<LandPurchaseOrder[]>([]);
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

  useEffect(() => {
    try {
      const authed = localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
      setAuthenticated(authed);
    } catch {
      setAuthenticated(false);
    }
    setListings(getLandListings());
    setOrders(getPurchaseOrders());
    setCheckingAuth(false);
  }, []);

  const refreshData = () => {
    setListings(getLandListings());
    setOrders(getPurchaseOrders());
  };

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
    setEmail('');
    setPasscode('');
  };

  const handleApproveAndList = (id: string) => {
    const next = updateLandListing(id, {
      approvalStatus: 'approved',
      forSale: true,
      saleStatus: 'available',
    });
    setListings(next);
  };

  const handleApproveOnly = (id: string) => {
    const next = updateLandListing(id, {
      approvalStatus: 'approved',
    });
    setListings(next);
  };

  const handleReject = (id: string) => {
    const next = updateLandListing(id, {
      approvalStatus: 'rejected',
      forSale: false,
    });
    setListings(next);
  };

  const handleToggleSaleStatus = (parcel: LandListing) => {
    const nextStatus = parcel.saleStatus === 'available' ? 'sold' : 'available';
    const next = updateLandListing(parcel.id, {
      forSale: true,
      saleStatus: nextStatus,
    });
    setListings(next);
  };

  const handleDeleteParcel = (id: string) => {
    const next = deleteLandListing(id);
    setListings(next);
  };

  const handleCompleteOrder = (orderId: string) => {
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, status: 'completed' as const } : o,
    );
    savePurchaseOrders(updated);
    setOrders(updated);
  };

  const handleCreateAdminParcel = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim()) return;

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
      priceUsd: Number(newPrice) || 50000,
      priceNgn: (Number(newPrice) || 50000) * NGN_PER_USD,
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

    setListings(getLandListings());
    setShowAddModal(false);
    setNewTitle('');
    setNewLocation('');
    setNewArea('');
    setNewPrice('');
    setNewDocRef('');
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#070B12] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </main>
    );
  }

  // Standalone Admin Gate (completely separate from the main public site)
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

  const pendingCount = listings.filter((l) => l.approvalStatus === 'pending_review').length;
  const forSaleCount = listings.filter((l) => l.forSale && l.saleStatus === 'available').length;
  const soldCount = listings.filter((l) => l.saleStatus === 'sold').length;

  return (
    <div className="min-h-screen bg-[#070B12] text-[#F1F5F9]">
      {/* Standalone Admin Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0B1120]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              Anagu Admin Console
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('registrations')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'registrations'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Land Registrations ({listings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'marketplace'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              For Sale Listings ({forSaleCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Purchase Orders ({orders.length})
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-9 px-3.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Land</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-5">
            <p className="text-xs text-slate-400">Total Registered Lands</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
              {listings.length}
            </p>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-5">
            <p className="text-xs text-slate-400">Pending Document Review</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-400">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-5">
            <p className="text-xs text-slate-400">Available for Sale</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {forSaleCount}
            </p>
          </div>
          <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-5">
            <p className="text-xs text-slate-400">Purchased / Sold</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-indigo-400">
              {soldCount}
            </p>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'registrations' ? 'bg-indigo-500 text-white' : 'bg-[#0F172A] text-slate-400'
            }`}
          >
            Registrations ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'marketplace' ? 'bg-indigo-500 text-white' : 'bg-[#0F172A] text-slate-400'
            }`}
          >
            For Sale ({forSaleCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              activeTab === 'orders' ? 'bg-indigo-500 text-white' : 'bg-[#0F172A] text-slate-400'
            }`}
          >
            Orders ({orders.length})
          </button>
        </div>

        {/* TAB 1: Land Registrations & Uploaded Documents */}
        {activeTab === 'registrations' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span>Registered Lands &amp; Uploaded Documents</span>
              </h2>
            </div>

            <div className="space-y-4">
              {listings.map((parcel) => (
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
                              ? `Sold (${formatUsd(getListingPriceUsd(parcel))} · ${formatEthFromUsd(getListingPriceUsd(parcel), 2)})`
                              : `For Sale (${formatUsd(getListingPriceUsd(parcel))} · ${formatEthFromUsd(getListingPriceUsd(parcel), 2)})`
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
                            · ETH: {parcel.ownerWalletAddress.slice(0, 6)}…{parcel.ownerWalletAddress.slice(-4)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveAndList(parcel.id)}
                        className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve &amp; List</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveOnly(parcel.id)}
                        className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                      >
                        Approve Only
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(parcel.id)}
                        className="h-9 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/30 text-rose-300 text-xs font-medium inline-flex items-center gap-1"
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
          </section>
        )}

        {/* TAB 2: For Sale Marketplace Management */}
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
                        <td className="px-5 py-4 font-mono tabular-nums text-white font-semibold">
                          <p>{formatUsd(getListingPriceUsd(parcel))}</p>
                          <p className="text-[11px] font-normal text-sky-400">
                            {formatEthFromUsd(getListingPriceUsd(parcel))}
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
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
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

        {/* TAB 3: Purchase Orders */}
        {activeTab === 'orders' && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-indigo-400" />
              <span>Buyer Purchase Orders</span>
            </h2>

            {orders.length === 0 ? (
              <div className="rounded-xl bg-[#0F172A] border border-slate-800 p-10 text-center text-sm text-slate-400">
                No purchase orders submitted yet.
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
                      <th className="px-5 py-3.5 text-left font-mono uppercase text-slate-400">Settlement</th>
                      <th className="px-5 py-3.5 text-right font-mono uppercase text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-4 font-mono text-indigo-400">{order.id}</td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white">{order.buyerName}</p>
                          <p className="text-slate-400">{order.buyerEmail} · {order.buyerPhone}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-white">{order.landTitle}</p>
                          <p className="font-mono text-slate-400">{order.parcelRef}</p>
                        </td>
                        <td className="px-5 py-4 font-mono tabular-nums text-white font-semibold">
                          <p>{formatUsd(getListingPriceUsd(order))}</p>
                          <p className="text-[11px] font-normal text-sky-400">
                            {formatEthFromUsd(getListingPriceUsd(order))}
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
                          <p
                            className={`font-mono mt-0.5 ${
                              order.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {order.status === 'completed' ? 'Completed' : 'Pending Settlement'}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {order.status !== 'completed' ? (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            >
                              Mark Completed
                            </button>
                          ) : (
                            <span className="text-emerald-400 font-mono">Settled</span>
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
      </main>

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
                  <label className="block text-xs text-slate-400 mb-1">Price (USD $)</label>
                  <input
                    type="number"
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
