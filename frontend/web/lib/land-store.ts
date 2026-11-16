export type LandCategory =
  | 'Residential'
  | 'Commercial'
  | 'Agricultural'
  | 'Industrial'
  | 'Mixed-Use';

export interface LandDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl?: string;
}

import {
  createRectangleAroundPoint,
  parseCoordinateString,
  type LatLngPoint,
} from './gis-utils';

export interface LandListing {
  id: string;
  title: string;
  parcelRef: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  state: string;
  location: string;
  areaSqm: number;
  category: LandCategory;
  documentType: string;
  documentNumber: string;
  priceNgn: number;
  forSale: boolean;
  saleStatus: 'available' | 'sold' | 'not_for_sale';
  approvalStatus: 'approved' | 'pending_review' | 'rejected';
  description: string;
  coordinates: string;
  lat?: number;
  lng?: number;
  polygon?: LatLngPoint[];
  perimeterMeters?: number;
  imageUrl: string;
  documents: LandDocument[];
  createdAt: string;
}

export interface LandPurchaseOrder {
  id: string;
  landId: string;
  landTitle: string;
  parcelRef: string;
  priceNgn: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  paymentMethod: 'Bank Escrow Transfer' | 'Mortgage Financing' | 'Direct Institutional Settlement';
  notes: string;
  status: 'pending_settlement' | 'completed';
  createdAt: string;
}

const LANDS_STORAGE_KEY = 'anagu_land_listings_v2';
const ORDERS_STORAGE_KEY = 'anagu_land_orders_v2';

export const CATEGORY_DEFAULT_IMAGES: Record<LandCategory, string> = {
  Residential: '/assets/lands/lekki_waterfront.jpg',
  Commercial: '/assets/lands/ikeja_commercial.jpg',
  Agricultural: '/assets/lands/ogun_agricultural.jpg',
  Industrial: '/assets/lands/ikeja_commercial.jpg',
  'Mixed-Use': '/assets/lands/abuja_maitama.jpg',
};

export const INITIAL_LAND_LISTINGS: LandListing[] = [
  {
    id: 'LND-2026-101',
    title: 'Lekki Peninsula Waterfront Plot 14',
    parcelRef: 'NG-LAG-LEK-2026-0089',
    ownerName: 'Adeleke Holdings Ltd',
    ownerEmail: 'estates@adelekeholdings.ng',
    ownerPhone: '+234 803 412 8890',
    state: 'Lagos State',
    location: 'Phase 1 Waterfront Corridor, Eti-Osa LGA, Lagos',
    areaSqm: 1240,
    category: 'Residential',
    documentType: 'Certificate of Occupancy (C of O)',
    documentNumber: 'LASG/LUAC/2024/0089',
    priceNgn: 185000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Cleared, beaconed waterfront residential parcel with paved dual-access frontage, perimeter drainage, and unobstructed lagoon view. Ready for immediate luxury residential development.',
    coordinates: '6.4382° N, 3.4721° E',
    imageUrl: '/assets/lands/lekki_waterfront.jpg',
    documents: [
      {
        id: 'DOC-101-A',
        name: 'LASG_CofO_Plot14_Lekki.pdf',
        size: 1420800,
        type: 'application/pdf',
        uploadedAt: '2026-09-12T10:30:00.000Z',
      },
      {
        id: 'DOC-101-B',
        name: 'SURCON_Beacon_Plan_0089.dwg',
        size: 845200,
        type: 'application/acad',
        uploadedAt: '2026-09-12T10:31:00.000Z',
      },
    ],
    createdAt: '2026-10-02T09:00:00.000Z',
  },
  {
    id: 'LND-2026-102',
    title: 'Maitama Diplomatic Ridge Estate Parcel',
    parcelRef: 'NG-ABJ-MAI-2026-0142',
    ownerName: 'Bello & Sons Capital',
    ownerEmail: 'acquisitions@bellocapital.ng',
    ownerPhone: '+234 809 772 1904',
    state: 'FCT Abuja',
    location: 'Cadastral Zone A05, Maitama District, Abuja',
    areaSqm: 2150,
    category: 'Mixed-Use',
    documentType: 'Right of Occupancy (R of O)',
    documentNumber: 'FCDA/AGIS/2025/0142',
    priceNgn: 320000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Elevated manicured estate plot inside a fully serviced diplomatic corridor with asphalt boulevard frontage, underground power ducting, and verified AGIS cadastral boundaries.',
    coordinates: '9.0820° N, 7.4983° E',
    imageUrl: '/assets/lands/abuja_maitama.jpg',
    documents: [
      {
        id: 'DOC-102-A',
        name: 'AGIS_Statutory_CofO_A05.pdf',
        size: 1984000,
        type: 'application/pdf',
        uploadedAt: '2026-09-18T14:15:00.000Z',
      },
    ],
    createdAt: '2026-10-08T11:20:00.000Z',
  },
  {
    id: 'LND-2026-103',
    title: 'Ikeja Central Business Corner Plot',
    parcelRef: 'NG-LAG-IKJ-2026-0318',
    ownerName: 'Vanguard Commercial Properties',
    ownerEmail: 'deals@vanguardprop.ng',
    ownerPhone: '+234 802 904 3311',
    state: 'Lagos State',
    location: 'Alausa / Obafemi Awolowo Way Axis, Ikeja, Lagos',
    areaSqm: 3400,
    category: 'Commercial',
    documentType: "Governor's Consent",
    documentNumber: 'LASG/GOV/2025/0318',
    priceNgn: 410000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'High-visibility corner commercial site fenced with twin vehicular gates, surrounded by dual-carriageway avenues. Ideal for corporate headquarters, retail complex, or medical center.',
    coordinates: '6.6018° N, 3.3515° E',
    imageUrl: '/assets/lands/ikeja_commercial.jpg',
    documents: [
      {
        id: 'DOC-103-A',
        name: 'Governors_Consent_Ikeja_0318.pdf',
        size: 2150400,
        type: 'application/pdf',
        uploadedAt: '2026-10-01T08:45:00.000Z',
      },
    ],
    createdAt: '2026-10-14T16:10:00.000Z',
  },
  {
    id: 'LND-2026-104',
    title: 'Sagamu Greenbelt Agricultural Acreage',
    parcelRef: 'NG-OGN-SAG-2026-0504',
    ownerName: 'Ogun Agro-Allied Ventures',
    ownerEmail: 'lands@ogunagro.ng',
    ownerPhone: '+234 814 550 7219',
    state: 'Ogun State',
    location: 'Sagamu-Benin Expressway Corridor, Ogun State',
    areaSqm: 24000,
    category: 'Agricultural',
    documentType: 'Deed of Assignment',
    documentNumber: 'OGS/SURV/2025/0504',
    priceNgn: 48000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Six contiguous acres of fertile arable farmland with graded all-season access road, natural watershed border, and registered Ogun State survey plan.',
    coordinates: '6.8485° N, 3.6463° E',
    imageUrl: '/assets/lands/ogun_agricultural.jpg',
    documents: [
      {
        id: 'DOC-104-A',
        name: 'Ogun_Registered_Survey_0504.pdf',
        size: 1120000,
        type: 'application/pdf',
        uploadedAt: '2026-10-10T12:00:00.000Z',
      },
    ],
    createdAt: '2026-10-19T13:40:00.000Z',
  },
  {
    id: 'LND-2026-105',
    title: 'Banana Island Crescent Residential Lot 7',
    parcelRef: 'NG-LAG-IKO-2026-0712',
    ownerName: 'Crestline Sovereign Estates',
    ownerEmail: 'sales@crestlineestates.ng',
    ownerPhone: '+234 805 112 6400',
    state: 'Lagos State',
    location: 'Zone K Waterfront Drive, Ikoyi, Lagos',
    areaSqm: 1500,
    category: 'Residential',
    documentType: 'Certificate of Occupancy (C of O)',
    documentNumber: 'LASG/IKO/2025/0712',
    priceNgn: 540000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Premier gated lagoon-front residential plot featuring compacted sand-filled elevation, shoreline sheet-piling, and verified digital deed history.',
    coordinates: '6.4648° N, 3.4552° E',
    imageUrl: '/assets/lands/lekki_waterfront.jpg',
    documents: [
      {
        id: 'DOC-105-A',
        name: 'Ikoyi_Title_Deed_0712.pdf',
        size: 1640000,
        type: 'application/pdf',
        uploadedAt: '2026-10-15T09:10:00.000Z',
      },
    ],
    createdAt: '2026-10-25T10:05:00.000Z',
  },
  {
    id: 'LND-2026-106',
    title: 'Wuse II Commercial Plaza Site',
    parcelRef: 'NG-ABJ-WUS-2026-0229',
    ownerName: 'Abuja Urban Developments',
    ownerEmail: 'office@abujadevelopments.ng',
    ownerPhone: '+234 807 620 4188',
    state: 'FCT Abuja',
    location: 'Adetokunbo Ademola Crescent, Wuse II, Abuja',
    areaSqm: 1850,
    category: 'Commercial',
    documentType: 'Certificate of Occupancy (C of O)',
    documentNumber: 'FCDA/WUS/2025/0229',
    priceNgn: 295000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Level commercial land parcel positioned along a bustling arterial avenue with complete utility connections and clean FCDA building clearance.',
    coordinates: '9.0765° N, 7.4792° E',
    imageUrl: '/assets/lands/ikeja_commercial.jpg',
    documents: [
      {
        id: 'DOC-106-A',
        name: 'FCDA_WuseII_Clearance.pdf',
        size: 980500,
        type: 'application/pdf',
        uploadedAt: '2026-10-21T15:30:00.000Z',
      },
    ],
    createdAt: '2026-10-28T08:50:00.000Z',
  },
  {
    id: 'LND-2026-107',
    title: 'New GRA Port Harcourt Serviced Plot',
    parcelRef: 'NG-RIV-PHC-2026-0411',
    ownerName: 'Delta Horizon Realty',
    ownerEmail: 'registry@deltahorizon.ng',
    ownerPhone: '+234 803 884 2201',
    state: 'Rivers State',
    location: 'Tombia Extension, New GRA, Port Harcourt',
    areaSqm: 980,
    category: 'Residential',
    documentType: 'Certificate of Occupancy (C of O)',
    documentNumber: 'RVSG/MLUD/2025/0411',
    priceNgn: 92000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Dry, fenced residential twin-plot inside a serene paved neighborhood with verified Rivers State Ministry of Lands title registration.',
    coordinates: '4.8242° N, 7.0014° E',
    imageUrl: '/assets/lands/abuja_maitama.jpg',
    documents: [
      {
        id: 'DOC-107-A',
        name: 'RVSG_CofO_NewGRA_0411.pdf',
        size: 1320000,
        type: 'application/pdf',
        uploadedAt: '2026-10-26T11:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T14:20:00.000Z',
  },
  {
    id: 'LND-2026-108',
    title: 'Ibadan Moniya Agro-Logistics Hub Land',
    parcelRef: 'NG-OYO-IBD-2026-0615',
    ownerName: 'Oyo Inland Corridor Partners',
    ownerEmail: 'info@oyocorridor.ng',
    ownerPhone: '+234 812 339 9045',
    state: 'Oyo State',
    location: 'Moniya Dry Port Axis, Akinyele LGA, Ibadan',
    areaSqm: 12000,
    category: 'Industrial',
    documentType: "Governor's Consent",
    documentNumber: 'OYSG/LND/2026/0615',
    priceNgn: 78000000,
    forSale: true,
    saleStatus: 'available',
    approvalStatus: 'approved',
    description:
      'Expansive industrial and agro-processing parcel adjacent to the rail freight terminal corridor, surveyed with clean boundary beacons.',
    coordinates: '7.5245° N, 3.9112° E',
    lat: 7.5245,
    lng: 3.9112,
    polygon: createRectangleAroundPoint({ lat: 7.5245, lng: 3.9112 }, 120, 100),
    perimeterMeters: 440,
    imageUrl: '/assets/lands/ogun_agricultural.jpg',
    documents: [
      {
        id: 'DOC-108-A',
        name: 'Oyo_Industrial_Title_0615.pdf',
        size: 1510000,
        type: 'application/pdf',
        uploadedAt: '2026-11-03T10:15:00.000Z',
      },
    ],
    createdAt: '2026-11-05T09:30:00.000Z',
  },
];

// Enrich initial seed listings with spatial coordinates & boundary polygons derived from areaSqm
const SEED_DIMENSIONS: Record<string, { lat: number; lng: number; w: number; l: number }> = {
  'LND-2026-101': { lat: 6.4382, lng: 3.4721, w: 31, l: 40 },
  'LND-2026-102': { lat: 9.0820, lng: 7.4983, w: 43, l: 50 },
  'LND-2026-103': { lat: 6.6018, lng: 3.3515, w: 50, l: 68 },
  'LND-2026-104': { lat: 6.8485, lng: 3.6463, w: 150, l: 160 },
  'LND-2026-105': { lat: 6.4648, lng: 3.4552, w: 30, l: 50 },
  'LND-2026-106': { lat: 9.0765, lng: 7.4792, w: 37, l: 50 },
  'LND-2026-107': { lat: 4.8242, lng: 7.0014, w: 28, l: 35 },
  'LND-2026-108': { lat: 7.5245, lng: 3.9112, w: 120, l: 100 },
};

for (const seed of INITIAL_LAND_LISTINGS) {
  const spec = SEED_DIMENSIONS[seed.id];
  if (spec) {
    seed.lat = spec.lat;
    seed.lng = spec.lng;
    seed.polygon = createRectangleAroundPoint({ lat: spec.lat, lng: spec.lng }, spec.w, spec.l);
    seed.perimeterMeters = (spec.w + spec.l) * 2;
  }
}

export const INITIAL_PURCHASE_ORDERS: LandPurchaseOrder[] = [
  {
    id: 'ORD-2026-301',
    landId: 'LND-2026-107',
    landTitle: 'New GRA Port Harcourt Serviced Plot',
    parcelRef: 'NG-RIV-PHC-2026-0411',
    priceNgn: 92000000,
    buyerName: 'Dr. Chinedu Okafor',
    buyerEmail: 'c.okafor@medconsult.ng',
    buyerPhone: '+234 806 551 0912',
    paymentMethod: 'Bank Escrow Transfer',
    notes: 'Requesting deed verification packet prior to final escrow release.',
    status: 'pending_settlement',
    createdAt: '2026-11-12T15:20:00.000Z',
  },
];

function enrichListingGeometry(item: LandListing): LandListing {
  if (item.lat !== undefined && item.lng !== undefined && item.polygon && item.polygon.length >= 3) {
    return item;
  }
  const seedSpec = SEED_DIMENSIONS[item.id];
  if (seedSpec) {
    return {
      ...item,
      lat: item.lat ?? seedSpec.lat,
      lng: item.lng ?? seedSpec.lng,
      polygon:
        item.polygon && item.polygon.length >= 3
          ? item.polygon
          : createRectangleAroundPoint(
              { lat: seedSpec.lat, lng: seedSpec.lng },
              seedSpec.w,
              seedSpec.l,
            ),
      perimeterMeters: item.perimeterMeters ?? (seedSpec.w + seedSpec.l) * 2,
    };
  }
  const parsedCoord = parseCoordinateString(item.coordinates);
  if (parsedCoord && (item.lat === undefined || item.lng === undefined)) {
    return {
      ...item,
      lat: parsedCoord.lat,
      lng: parsedCoord.lng,
    };
  }
  return item;
}

export function getLandListings(): LandListing[] {
  if (typeof window === 'undefined') return INITIAL_LAND_LISTINGS;
  try {
    const raw = localStorage.getItem(LANDS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LANDS_STORAGE_KEY, JSON.stringify(INITIAL_LAND_LISTINGS));
      return INITIAL_LAND_LISTINGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as LandListing[]).map(enrichListingGeometry);
    }
    return INITIAL_LAND_LISTINGS;
  } catch {
    return INITIAL_LAND_LISTINGS;
  }
}

export function saveLandListings(listings: LandListing[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANDS_STORAGE_KEY, JSON.stringify(listings));
  } catch {
    // If localStorage quota is exceeded due to large base64 previews, strip dataUrls from older items and retry
    try {
      const compact = listings.map((item) => ({
        ...item,
        documents: item.documents.map((doc) => ({ ...doc, dataUrl: undefined })),
      }));
      localStorage.setItem(LANDS_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore storage error
    }
  }
}

export function addLandListing(
  input: Omit<LandListing, 'id' | 'parcelRef' | 'createdAt' | 'imageUrl'> & {
    parcelRef?: string;
    imageUrl?: string;
  },
): LandListing {
  const listings = getLandListings();
  const num = Math.floor(1000 + Math.random() * 9000);
  const stateCode = input.state.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const firstImageDoc = input.documents.find(
    (d) => d.type.startsWith('image/') && d.dataUrl,
  );

  const newListing: LandListing = {
    ...input,
    id: `LND-${new Date().getFullYear()}-${num}`,
    parcelRef: input.parcelRef?.trim() || `NG-${stateCode}-LND-${new Date().getFullYear()}-${num}`,
    imageUrl:
      input.imageUrl ||
      firstImageDoc?.dataUrl ||
      CATEGORY_DEFAULT_IMAGES[input.category] ||
      '/assets/lands/lekki_waterfront.jpg',
    createdAt: new Date().toISOString(),
  };

  saveLandListings([newListing, ...listings]);
  return newListing;
}

export function updateLandListing(
  id: string,
  updates: Partial<LandListing>,
): LandListing[] {
  const listings = getLandListings();
  const next = listings.map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveLandListings(next);
  return next;
}

export function deleteLandListing(id: string): LandListing[] {
  const listings = getLandListings().filter((item) => item.id !== id);
  saveLandListings(listings);
  return listings;
}

export function getPurchaseOrders(): LandPurchaseOrder[] {
  if (typeof window === 'undefined') return INITIAL_PURCHASE_ORDERS;
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_PURCHASE_ORDERS));
      return INITIAL_PURCHASE_ORDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PURCHASE_ORDERS;
  } catch {
    return INITIAL_PURCHASE_ORDERS;
  }
}

export function savePurchaseOrders(orders: LandPurchaseOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage error
  }
}

export function createPurchaseOrder(
  input: Omit<LandPurchaseOrder, 'id' | 'status' | 'createdAt'>,
): LandPurchaseOrder {
  const orders = getPurchaseOrders();
  const order: LandPurchaseOrder = {
    ...input,
    id: `ORD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
    status: 'pending_settlement',
    createdAt: new Date().toISOString(),
  };
  savePurchaseOrders([order, ...orders]);
  updateLandListing(input.landId, { saleStatus: 'sold' });
  return order;
}

export function formatNaira(amount: number): string {
  if (!amount || Number.isNaN(amount)) return 'Price on request';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
