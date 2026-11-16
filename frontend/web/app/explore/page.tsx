'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import {
  getLandListings,
  createPurchaseOrder,
  formatNaira,
  formatFileSize,
  type LandListing,
  type LandCategory,
  type LandPurchaseOrder,
} from '@/lib/land-store';
import ExploreParcelsMap from '@/components/gis/ExploreParcelsMap';
import ParcelMiniMap from '@/components/gis/ParcelMiniMap';
import {
  Search,
  MapPin,
  Maximize2,
  FileText,
  CheckCircle2,
  X,
  ArrowRight,
  ShoppingBag,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Map as MapIcon,
} from 'lucide-react';

const CATEGORIES: Array<'All' | LandCategory> = [
  'All',
  'Residential',
  'Commercial',
  'Agricultural',
  'Industrial',
  'Mixed-Use',
];

export default function ExploreLandPage() {
  const [listings, setListings] = useState<LandListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | LandCategory>('All');
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'area_desc'>('newest');
  const [showSold, setShowSold] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [inspectVisualTab, setInspectVisualTab] = useState<'map' | 'photo'>('map');

  // Active modals
  const [inspectParcel, setInspectParcel] = useState<LandListing | null>(null);
  const [buyParcel, setBuyParcel] = useState<LandListing | null>(null);

  // Purchase form state
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<LandPurchaseOrder['paymentMethod']>(
    'Bank Escrow Transfer',
  );
  const [buyerNotes, setBuyerNotes] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<LandPurchaseOrder | null>(null);

  useEffect(() => {
    setListings(getLandListings());
    setLoaded(true);
  }, []);

  const forSaleListings = useMemo(() => {
    return listings.filter(
      (item) => item.forSale && item.approvalStatus !== 'rejected',
    );
  }, [listings]);

  const availableStates = useMemo(() => {
    const unique = Array.from(new Set(forSaleListings.map((item) => item.state))).sort();
    return ['All States', ...unique];
  }, [forSaleListings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = forSaleListings.filter((item) => {
      if (!showSold && item.saleStatus === 'sold') return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedState !== 'All States' && item.state !== selectedState) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.parcelRef.toLowerCase().includes(q) ||
        item.documentType.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_asc') return a.priceNgn - b.priceNgn;
      if (sortBy === 'price_desc') return b.priceNgn - a.priceNgn;
      if (sortBy === 'area_desc') return b.areaSqm - a.areaSqm;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [forSaleListings, searchQuery, selectedCategory, selectedState, sortBy, showSold]);

  const handleOpenBuy = (parcel: LandListing) => {
    setInspectParcel(null);
    setBuyParcel(parcel);
    setBuyError(null);
    setCompletedOrder(null);
  };

  const handlePurchaseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!buyParcel) return;
    setBuyError(null);

    if (!buyerName.trim()) {
      setBuyError('Please enter your full name.');
      return;
    }
    if (!buyerEmail.trim() || !buyerEmail.includes('@')) {
      setBuyError('Please enter a valid email address.');
      return;
    }
    if (!buyerPhone.trim()) {
      setBuyError('Please enter a contact phone number.');
      return;
    }

    const order = createPurchaseOrder({
      landId: buyParcel.id,
      landTitle: buyParcel.title,
      parcelRef: buyParcel.parcelRef,
      priceNgn: buyParcel.priceNgn,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim(),
      buyerPhone: buyerPhone.trim(),
      paymentMethod,
      notes: buyerNotes.trim(),
    });

    setListings(getLandListings());
    setCompletedOrder(order);
    setBuyerName('');
    setBuyerEmail('');
    setBuyerPhone('');
    setBuyerNotes('');
  };

  const availableCount = forSaleListings.filter((l) => l.saleStatus === 'available').length;

  return (
    <div className="min-h-screen bg-[#020305] text-[#F4F7FB] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[rgba(91,133,167,0.18)]">
            <div className="max-w-2xl">
              <p className="text-xs font-mono uppercase tracking-wider text-[#38BDF8] mb-2">
                Verified Land Marketplace
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F4F7FB]">
                Explore Land Out for Sale
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#94A3B8] leading-relaxed">
                Scroll through surveyed residential, commercial, agricultural, and industrial parcels
                listed for direct acquisition. Inspect title documents and purchase securely.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[#94A3B8]">Available Parcels</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#F4F7FB]">
                  {availableCount}
                </p>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Register Land for Sale</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="mb-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by location, title, state, or parcel ref..."
                  className="w-full h-11 pl-10 pr-4 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-sm text-[#F4F7FB] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              {/* State filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  aria-label="Filter by State"
                  className="w-full h-11 px-3.5 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                >
                  {availableStates.map((st) => (
                    <option key={st} value={st} className="bg-[#0A0F16]">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="md:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Sort parcels"
                  className="w-full h-11 px-3.5 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="newest" className="bg-[#0A0F16]">Newest Listed</option>
                  <option value="price_asc" className="bg-[#0A0F16]">Price: Low to High</option>
                  <option value="price_desc" className="bg-[#0A0F16]">Price: High to Low</option>
                  <option value="area_desc" className="bg-[#0A0F16]">Largest Size</option>
                </select>
              </div>

              {/* Toggle Sold */}
              <div className="md:col-span-2 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowSold(!showSold)}
                  className={`w-full h-11 px-3 rounded-[8px] border text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    showSold
                      ? 'bg-[#0A0F16] border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                      : 'bg-[#38BDF8]/10 border-[#38BDF8]/40 text-[#38BDF8]'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{showSold ? 'Showing All' : 'Available Only'}</span>
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((category) => {
                const active = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                        : 'bg-[#0A0F16] text-[#94A3B8] border border-[rgba(91,133,167,0.20)] hover:text-[#F4F7FB] hover:border-[#38BDF8]/40'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-[#64748B]">
                  {filteredListings.length} {filteredListings.length === 1 ? 'parcel' : 'parcels'} found
                </span>

                <div className="inline-flex rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                        : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Grid View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                      viewMode === 'map'
                        ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                        : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                    }`}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                    <span>GIS Map View</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {!loaded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-[420px] rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.16)] animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {loaded && filteredListings.length === 0 && (
            <div className="rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] p-12 text-center">
              <p className="text-base font-medium text-[#F4F7FB]">
                No land parcels match your current filters.
              </p>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Try clearing your search query or switching to All States.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedState('All States');
                  setShowSold(true);
                }}
                className="mt-5 px-4 py-2 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Scrollable Land Grid or GIS Map View */}
          {loaded && filteredListings.length > 0 && viewMode === 'map' && (
            <ExploreParcelsMap
              parcels={filteredListings}
              onInspect={(parcel) => {
                setInspectVisualTab('map');
                setInspectParcel(parcel);
              }}
              onBuy={handleOpenBuy}
            />
          )}

          {loaded && filteredListings.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((parcel) => {
                const isSold = parcel.saleStatus === 'sold';
                return (
                  <article
                    key={parcel.id}
                    className="group rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] hover:border-[#38BDF8]/50 overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {/* Land Image (4:3) */}
                    <div className="relative aspect-[4/3] w-full bg-[#05080D] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={parcel.imageUrl}
                        alt={parcel.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#020305]/85 via-[#020305]/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                        <span className="text-xs font-mono text-[#E2E8F0]">
                          {parcel.state} Â· {parcel.category}
                        </span>
                        <span
                          className={`text-xs font-mono font-semibold ${
                            isSold ? 'text-rose-300' : 'text-emerald-300'
                          }`}
                        >
                          {isSold
                            ? 'Sold'
                            : parcel.approvalStatus === 'pending_review'
                            ? 'Pending Review'
                            : 'For Sale'}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <p className="text-xs font-mono text-[#64748B] mb-1">
                          {parcel.parcelRef}
                        </p>
                        <h2 className="text-base font-semibold text-[#F4F7FB] leading-snug line-clamp-1">
                          {parcel.title}
                        </h2>
                        <p className="mt-1.5 text-xs text-[#94A3B8] flex items-start gap-1.5 line-clamp-2">
                          <MapPin className="h-3.5 w-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                          <span>{parcel.location}</span>
                        </p>

                        <div className="mt-4 pt-3 border-t border-[rgba(91,133,167,0.14)] flex items-center justify-between text-xs text-[#94A3B8]">
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Maximize2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                            {parcel.areaSqm.toLocaleString()} sqm
                          </span>
                          <span className="truncate max-w-[165px]" title={parcel.documentType}>
                            {parcel.documentType}
                          </span>
                        </div>
                      </div>

                      {/* Price & Actions */}
                      <div className="pt-3 border-t border-[rgba(91,133,167,0.14)] flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] text-[#64748B]">Asking Price</p>
                          <p className="text-lg font-bold font-mono tabular-nums text-[#F4F7FB]">
                            {formatNaira(parcel.priceNgn)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectParcel(parcel)}
                            className="h-10 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-xs font-medium text-[#94A3B8] hover:text-[#F4F7FB] hover:border-[#38BDF8]/50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSold}
                            onClick={() => handleOpenBuy(parcel)}
                            className={`h-10 px-4 rounded-[8px] text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                              isSold
                                ? 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                                : 'bg-[#38BDF8] text-[#020305] hover:bg-[#67E8F9]'
                            }`}
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>{isSold ? 'Sold' : 'Buy Land'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Inspect Parcel Modal */}
      {inspectParcel && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${inspectParcel.title}`}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.30)] shadow-2xl">
            <div className="p-4 border-b border-[rgba(91,133,167,0.16)] flex items-center justify-between gap-3">
              <div className="inline-flex rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-0.5">
                <button
                  type="button"
                  onClick={() => setInspectVisualTab('map')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    inspectVisualTab === 'map'
                      ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  <span>GIS Satellite Boundary</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectVisualTab('photo')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    inspectVisualTab === 'photo'
                      ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                      : 'text-[#94A3B8] hover:text-[#F4F7FB]'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Site Preview</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectParcel(null)}
                className="h-9 w-9 rounded-lg bg-[#05080D] text-[#F4F7FB] border border-[rgba(91,133,167,0.3)] flex items-center justify-center hover:border-[#38BDF8]"
                aria-label="Close parcel details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inspectVisualTab === 'map' ? (
              <div className="p-4 pb-0">
                <ParcelMiniMap parcel={inspectParcel} />
              </div>
            ) : (
              <div className="relative aspect-[16/9] w-full bg-[#05080D]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspectParcel.imageUrl}
                  alt={inspectParcel.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-[#38BDF8]">
                    {inspectParcel.parcelRef} Â· {inspectParcel.category}
                  </p>
                  <h2 className="text-xl font-bold text-[#F4F7FB] mt-1">
                    {inspectParcel.title}
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span>{inspectParcel.location}, {inspectParcel.state}</span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-[#64748B]">Price</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#F4F7FB]">
                    {formatNaira(inspectParcel.priceNgn)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#94A3B8] leading-relaxed">
                {inspectParcel.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[rgba(91,133,167,0.16)] text-xs">
                <div>
                  <p className="text-[#64748B]">Land Size</p>
                  <p className="font-mono font-semibold text-[#F4F7FB] mt-0.5">
                    {inspectParcel.areaSqm.toLocaleString()} sqm
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Title Document</p>
                  <p className="font-medium text-[#F4F7FB] mt-0.5">
                    {inspectParcel.documentType}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Document Ref</p>
                  <p className="font-mono text-[#F4F7FB] mt-0.5 truncate">
                    {inspectParcel.documentNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Coordinates</p>
                  <p className="font-mono text-[#F4F7FB] mt-0.5">
                    {inspectParcel.coordinates || 'Surveyed'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(91,133,167,0.16)]">
                <p className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-2">
                  Attached Title Documents ({inspectParcel.documents.length})
                </p>
                <div className="space-y-2">
                  {inspectParcel.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-[#38BDF8] shrink-0" />
                        <span className="text-[#F4F7FB] truncate">{doc.name}</span>
                      </div>
                      <span className="text-[#64748B] font-mono shrink-0 ml-3">
                        {formatFileSize(doc.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[rgba(91,133,167,0.16)] flex items-center justify-between gap-3">
                <div className="text-xs text-[#94A3B8]">
                  Seller: <span className="text-[#F4F7FB] font-medium">{inspectParcel.ownerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectParcel(null)}
                    className="h-10 px-4 rounded-[8px] border border-[rgba(91,133,167,0.25)] text-xs text-[#94A3B8] hover:text-[#F4F7FB]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={inspectParcel.saleStatus === 'sold'}
                    onClick={() => handleOpenBuy(inspectParcel)}
                    className="h-10 px-5 rounded-[8px] bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] disabled:opacity-50"
                  >
                    {inspectParcel.saleStatus === 'sold' ? 'Already Sold' : 'Buy This Land'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Land Modal */}
      {buyParcel && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Purchase ${buyParcel.title}`}
        >
          <div className="w-full max-w-lg rounded-[12px] bg-[#0A0F16] border border-[rgba(91,133,167,0.30)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[rgba(91,133,167,0.16)]">
              <div>
                <p className="text-xs font-mono text-[#38BDF8]">{buyParcel.parcelRef}</p>
                <h2 className="text-lg font-bold text-[#F4F7FB] mt-0.5">
                  {completedOrder ? 'Land Purchase Confirmed' : `Buy: ${buyParcel.title}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBuyParcel(null);
                  setCompletedOrder(null);
                }}
                className="h-8 w-8 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB] flex items-center justify-center"
                aria-label="Close purchase modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {completedOrder ? (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-[#94A3B8]">
                    Your purchase order for <strong className="text-[#F4F7FB]">{completedOrder.landTitle}</strong> has been recorded.
                  </p>
                  <p className="mt-2 inline-block px-3 py-1 rounded bg-[#05080D] border border-[rgba(91,133,167,0.22)] font-mono text-xs text-[#38BDF8]">
                    Order Reference: {completedOrder.id}
                  </p>
                </div>
                <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-4 text-left text-xs space-y-1.5">
                  <p className="text-[#94A3B8]">
                    Buyer: <span className="text-[#F4F7FB]">{completedOrder.buyerName}</span>
                  </p>
                  <p className="text-[#94A3B8]">
                    Settlement Amount: <span className="font-mono text-[#F4F7FB]">{formatNaira(completedOrder.priceNgn)}</span>
                  </p>
                  <p className="text-[#94A3B8]">
                    Method: <span className="text-[#F4F7FB]">{completedOrder.paymentMethod}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBuyParcel(null);
                    setCompletedOrder(null);
                  }}
                  className="w-full h-11 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9]"
                >
                  Continue Exploring Land
                </button>
              </div>
            ) : (
              <form onSubmit={handlePurchaseSubmit} className="mt-5 space-y-4">
                <div className="rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.18)] p-3.5 flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">
                    {buyParcel.location} Â· {buyParcel.areaSqm.toLocaleString()} sqm
                  </span>
                  <span className="font-mono font-bold text-[#38BDF8] tabular-nums">
                    {formatNaira(buyParcel.priceNgn)}
                  </span>
                </div>

                {buyError && (
                  <div className="rounded-lg bg-rose-950/30 border border-rose-500/40 px-3 py-2 text-xs text-rose-300">
                    {buyError}
                  </div>
                )}

                <div>
                  <label htmlFor="buyerName" className="block text-xs text-[#94A3B8] mb-1">
                    Buyer Full Name *
                  </label>
                  <input
                    id="buyerName"
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Chief Adewale Ogunleye"
                    className="w-full h-10 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="buyerEmail" className="block text-xs text-[#94A3B8] mb-1">
                      Email Address *
                    </label>
                    <input
                      id="buyerEmail"
                      type="email"
                      required
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="buyer@email.com"
                      className="w-full h-10 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="buyerPhone" className="block text-xs text-[#94A3B8] mb-1">
                      Phone Number *
                    </label>
                    <input
                      id="buyerPhone"
                      type="tel"
                      required
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full h-10 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="paymentMethod" className="block text-xs text-[#94A3B8] mb-1">
                    Settlement Method
                  </label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as LandPurchaseOrder['paymentMethod'])
                    }
                    className="w-full h-10 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                  >
                    <option value="Bank Escrow Transfer" className="bg-[#0A0F16]">
                      Bank Escrow Transfer
                    </option>
                    <option value="Mortgage Financing" className="bg-[#0A0F16]">
                      Mortgage Financing
                    </option>
                    <option value="Direct Institutional Settlement" className="bg-[#0A0F16]">
                      Direct Institutional Settlement
                    </option>
                  </select>
                </div>

                <div>
                  <label htmlFor="buyerNotes" className="block text-xs text-[#94A3B8] mb-1">
                    Notes / Offer Details (Optional)
                  </label>
                  <textarea
                    id="buyerNotes"
                    rows={2}
                    value={buyerNotes}
                    onChange={(e) => setBuyerNotes(e.target.value)}
                    placeholder="Site inspection request, closing timeline, or solicitor contact..."
                    className="w-full p-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBuyParcel(null)}
                    className="flex-1 h-11 rounded-[8px] border border-[rgba(91,133,167,0.25)] text-sm text-[#94A3B8] hover:text-[#F4F7FB]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold hover:bg-[#67E8F9]"
                  >
                    Confirm Land Purchase
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

