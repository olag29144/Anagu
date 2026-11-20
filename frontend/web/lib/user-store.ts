import {
  getLandListings,
  getPurchaseOrders,
  getListingPriceUsd,
  type LandListing,
  type LandPurchaseOrder,
} from './land-store';

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  walletAddress?: string;
  authProvider?: 'local' | 'google';
  googleId?: string;
  avatarUrl?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastActiveAt: string;
}

export interface UserAccountWithStats {
  account: UserAccount;
  lands: LandListing[];
  totalLands: number;
  approvedLands: number;
  pendingLands: number;
  rejectedLands: number;
  forSaleLands: number;
  soldLands: number;
  totalDocuments: number;
  buyerOrders: LandPurchaseOrder[];
  completedPaymentsCount: number;
  pendingPaymentsCount: number;
  totalPaidUsd: number;
  sellerOrders: LandPurchaseOrder[];
}

const USERS_STORAGE_KEY = 'anagu_user_accounts_v1';
const ACTIVE_USER_ID_KEY = 'anagu_active_user_id_v1';

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'USR-ADELEKE',
    fullName: 'Adeleke Holdings Ltd',
    email: 'estates@adelekeholdings.ng',
    phone: '+234 803 412 8890',
    walletAddress: '0x71C83812a19f20108A456789b910123456789012',
    status: 'active',
    createdAt: '2026-10-01T08:00:00.000Z',
    lastActiveAt: '2026-11-16T10:45:00.000Z',
  },
  {
    id: 'USR-BELLO',
    fullName: 'Bello & Sons Capital',
    email: 'acquisitions@bellocapital.ng',
    phone: '+234 809 772 1904',
    status: 'active',
    createdAt: '2026-10-05T10:00:00.000Z',
    lastActiveAt: '2026-10-08T11:20:00.000Z',
  },
  {
    id: 'USR-VANGUARD',
    fullName: 'Vanguard Commercial Properties',
    email: 'deals@vanguardprop.ng',
    phone: '+234 802 904 3311',
    status: 'active',
    createdAt: '2026-10-10T09:30:00.000Z',
    lastActiveAt: '2026-10-14T16:10:00.000Z',
  },
  {
    id: 'USR-OGUNAGRO',
    fullName: 'Ogun Agro-Allied Ventures',
    email: 'lands@ogunagro.ng',
    phone: '+234 814 550 7219',
    status: 'active',
    createdAt: '2026-10-15T12:00:00.000Z',
    lastActiveAt: '2026-10-19T13:40:00.000Z',
  },
  {
    id: 'USR-CRESTLINE',
    fullName: 'Crestline Sovereign Estates',
    email: 'sales@crestlineestates.ng',
    phone: '+234 805 112 6400',
    status: 'active',
    createdAt: '2026-10-20T09:00:00.000Z',
    lastActiveAt: '2026-10-25T10:05:00.000Z',
  },
  {
    id: 'USR-ABUJAURBAN',
    fullName: 'Abuja Urban Developments',
    email: 'office@abujadevelopments.ng',
    phone: '+234 807 620 4188',
    status: 'active',
    createdAt: '2026-10-22T14:00:00.000Z',
    lastActiveAt: '2026-10-28T08:50:00.000Z',
  },
  {
    id: 'USR-DELTAHORIZON',
    fullName: 'Delta Horizon Realty',
    email: 'registry@deltahorizon.ng',
    phone: '+234 803 884 2201',
    status: 'active',
    createdAt: '2026-10-26T11:00:00.000Z',
    lastActiveAt: '2026-11-12T15:20:00.000Z',
  },
  {
    id: 'USR-OYOCORRIDOR',
    fullName: 'Oyo Inland Corridor Partners',
    email: 'info@oyocorridor.ng',
    phone: '+234 812 339 9045',
    status: 'active',
    createdAt: '2026-11-01T08:30:00.000Z',
    lastActiveAt: '2026-11-05T09:30:00.000Z',
  },
  {
    id: 'USR-OKAFOR',
    fullName: 'Dr. Chinedu Okafor',
    email: 'c.okafor@medconsult.ng',
    phone: '+234 806 551 0912',
    status: 'active',
    createdAt: '2026-11-11T10:00:00.000Z',
    lastActiveAt: '2026-11-12T15:20:00.000Z',
  },
];

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '').trim();
}

function normalizeEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  if (!clean || clean === 'not provided') return '';
  return clean;
}

export function getUserAccounts(): UserAccount[] {
  if (typeof window === 'undefined') return INITIAL_USER_ACCOUNTS;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USER_ACCOUNTS));
      return INITIAL_USER_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as UserAccount[];
    }
    return INITIAL_USER_ACCOUNTS;
  } catch {
    return INITIAL_USER_ACCOUNTS;
  }
}

export function saveUserAccounts(accounts: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveUserAccount(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (!activeId) return null;
    const accounts = getUserAccounts();
    return accounts.find((u) => u.id === activeId) ?? null;
  } catch {
    return null;
  }
}

export function setActiveUserAccount(userId: string): UserAccount | null {
  if (typeof window === 'undefined') return null;
  const accounts = getUserAccounts();
  const target = accounts.find((u) => u.id === userId) ?? null;
  if (!target) return null;
  try {
    localStorage.setItem(ACTIVE_USER_ID_KEY, target.id);
    const updated = accounts.map((u) =>
      u.id === target.id ? { ...u, lastActiveAt: new Date().toISOString() } : u,
    );
    saveUserAccounts(updated);
    window.dispatchEvent(new Event('anagu-user-changed'));
  } catch {
    // Ignore storage error
  }
  return target;
}

export function clearActiveUserAccount(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    window.dispatchEvent(new Event('anagu-user-changed'));
  } catch {
    // Ignore
  }
}

export function findUserByIdentifier(identifier: string): UserAccount | null {
  const clean = identifier.trim().toLowerCase();
  const cleanPhone = normalizePhone(identifier);
  if (!clean && !cleanPhone) return null;

  const accounts = getUserAccounts();
  return (
    accounts.find((u) => {
      const emailMatch = normalizeEmail(u.email) !== '' && normalizeEmail(u.email) === clean;
      const phoneMatch =
        cleanPhone.length >= 6 &&
        normalizePhone(u.phone) !== '' &&
        normalizePhone(u.phone).endsWith(cleanPhone.slice(-8));
      return emailMatch || phoneMatch;
    }) ?? null
  );
}

export function signInUser(identifier: string): {
  user: UserAccount | null;
  error: string | null;
} {
  const match = findUserByIdentifier(identifier);
  if (!match) {
    return {
      user: null,
      error: 'No account found with that email or phone number. Please create an account below.',
    };
  }
  if (match.status === 'suspended') {
    return {
      user: null,
      error: 'This user account has been suspended by the registry administration.',
    };
  }
  const active = setActiveUserAccount(match.id);
  return { user: active, error: null };
}

export function createUserAccount(input: {
  fullName: string;
  phone: string;
  email?: string;
  walletAddress?: string;
}): { user: UserAccount | null; error: string | null } {
  const accounts = getUserAccounts();
  const cleanEmail = normalizeEmail(input.email ?? '');
  const cleanPhone = normalizePhone(input.phone);

  const duplicate = accounts.find((u) => {
    const emailHit = cleanEmail !== '' && normalizeEmail(u.email) === cleanEmail;
    const phoneHit = cleanPhone.length >= 6 && normalizePhone(u.phone) === cleanPhone;
    return emailHit || phoneHit;
  });

  if (duplicate) {
    if (duplicate.status === 'suspended') {
      return {
        user: null,
        error: 'An account with these details is currently suspended.',
      };
    }
    const active = setActiveUserAccount(duplicate.id);
    return { user: active, error: null };
  }

  const now = new Date().toISOString();
  const newUser: UserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    fullName: input.fullName.trim(),
    email: cleanEmail || 'Not provided',
    phone: input.phone.trim(),
    walletAddress: input.walletAddress?.trim() || undefined,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([newUser, ...accounts]);
  setActiveUserAccount(newUser.id);
  return { user: newUser, error: null };
}

export function signUpOrSignInWithGoogle(input: {
  fullName: string;
  email: string;
  googleId?: string;
  avatarUrl?: string;
}): { user: UserAccount | null; error: string | null } {
  const accounts = getUserAccounts();
  const cleanEmail = normalizeEmail(input.email);
  const now = new Date().toISOString();

  const existing = accounts.find(
    (u) =>
      (input.googleId && u.googleId === input.googleId) ||
      (cleanEmail !== '' && normalizeEmail(u.email) === cleanEmail),
  );

  if (existing) {
    if (existing.status === 'suspended') {
      return {
        user: null,
        error: 'This user account has been suspended by the registry administration.',
      };
    }
    const updated = accounts.map((u) =>
      u.id === existing.id
        ? {
            ...u,
            fullName: u.fullName || input.fullName.trim(),
            authProvider: 'google' as const,
            googleId: input.googleId ?? u.googleId,
            avatarUrl: input.avatarUrl ?? u.avatarUrl,
            lastActiveAt: now,
          }
        : u,
    );
    saveUserAccounts(updated);
    const active = setActiveUserAccount(existing.id);
    return { user: active, error: null };
  }

  const created: UserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    fullName: input.fullName.trim() || cleanEmail || 'Google User',
    email: cleanEmail,
    phone: 'Not provided',
    authProvider: 'google',
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([created, ...accounts]);
  setActiveUserAccount(created.id);
  return { user: created, error: null };
}

export function ensureUserAccountForRegistration(input: {
  fullName: string;
  phone: string;
  email?: string;
  walletAddress?: string;
}): UserAccount {
  const current = getActiveUserAccount();
  if (current) {
    return current;
  }

  const accounts = getUserAccounts();
  const cleanEmail = normalizeEmail(input.email ?? '');
  const cleanPhone = normalizePhone(input.phone);

  const existing = accounts.find((u) => {
    const emailHit = cleanEmail !== '' && normalizeEmail(u.email) === cleanEmail;
    const phoneHit = cleanPhone.length >= 6 && normalizePhone(u.phone) === cleanPhone;
    return emailHit || phoneHit;
  });

  if (existing) {
    setActiveUserAccount(existing.id);
    return existing;
  }

  const now = new Date().toISOString();
  const created: UserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    fullName: input.fullName.trim(),
    email: cleanEmail || 'Not provided',
    phone: input.phone.trim(),
    walletAddress: input.walletAddress?.trim() || undefined,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([created, ...accounts]);
  setActiveUserAccount(created.id);
  return created;
}

export function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserAccount, 'fullName' | 'email' | 'phone' | 'walletAddress'>>,
): UserAccount | null {
  const accounts = getUserAccounts();
  let updatedUser: UserAccount | null = null;
  const next = accounts.map((u) => {
    if (u.id !== userId) return u;
    updatedUser = {
      ...u,
      ...updates,
      lastActiveAt: new Date().toISOString(),
    };
    return updatedUser;
  });
  saveUserAccounts(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('anagu-user-changed'));
  }
  return updatedUser;
}

export function doesLandBelongToUser(land: LandListing, user: UserAccount): boolean {
  if (land.userId && land.userId === user.id) return true;
  const userEmail = normalizeEmail(user.email);
  const landEmail = normalizeEmail(land.ownerEmail);
  if (userEmail && landEmail && userEmail === landEmail) return true;

  const userPhone = normalizePhone(user.phone);
  const landPhone = normalizePhone(land.ownerPhone);
  if (userPhone.length >= 6 && landPhone.length >= 6 && userPhone === landPhone) {
    return true;
  }
  return false;
}

export function doesOrderBelongToBuyer(order: LandPurchaseOrder, user: UserAccount): boolean {
  if (order.buyerUserId && order.buyerUserId === user.id) return true;
  const userEmail = normalizeEmail(user.email);
  const buyerEmail = normalizeEmail(order.buyerEmail);
  if (userEmail && buyerEmail && userEmail === buyerEmail) return true;

  const userPhone = normalizePhone(user.phone);
  const buyerPhone = normalizePhone(order.buyerPhone);
  if (userPhone.length >= 6 && buyerPhone.length >= 6 && userPhone === buyerPhone) {
    return true;
  }
  return false;
}

export function getLandsForUser(user: UserAccount, allListings?: LandListing[]): LandListing[] {
  const listings = allListings ?? getLandListings();
  return listings.filter((land) => doesLandBelongToUser(land, user));
}

export function getBuyerOrdersForUser(
  user: UserAccount,
  allOrders?: LandPurchaseOrder[],
): LandPurchaseOrder[] {
  const orders = allOrders ?? getPurchaseOrders();
  return orders.filter((order) => doesOrderBelongToBuyer(order, user));
}

export function getSellerOrdersForUser(
  user: UserAccount,
  allListings?: LandListing[],
  allOrders?: LandPurchaseOrder[],
): LandPurchaseOrder[] {
  const myLands = getLandsForUser(user, allListings);
  const myLandIds = new Set(myLands.map((l) => l.id));
  const orders = allOrders ?? getPurchaseOrders();
  return orders.filter((order) => myLandIds.has(order.landId));
}

// ============================================================================
// Admin Aggregation & Account Management Helpers (used ONLY by /admin)
// ============================================================================

export function getUserAccountsWithStats(): UserAccountWithStats[] {
  const storedAccounts = getUserAccounts();
  const allListings = getLandListings();
  const allOrders = getPurchaseOrders();

  // Merge any ad-hoc land owners or buyers who are not yet in storedAccounts
  const accountsMap = new Map<string, UserAccount>();
  for (const acc of storedAccounts) {
    accountsMap.set(acc.id, acc);
  }

  for (const land of allListings) {
    const matched = Array.from(accountsMap.values()).find((u) => doesLandBelongToUser(land, u));
    if (!matched) {
      const syntheticId =
        land.userId ||
        `USR-${(normalizeEmail(land.ownerEmail) || normalizePhone(land.ownerPhone) || land.id)
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 10)
          .toUpperCase()}`;
      accountsMap.set(syntheticId, {
        id: syntheticId,
        fullName: land.ownerName,
        email: land.ownerEmail,
        phone: land.ownerPhone,
        walletAddress: land.ownerWalletAddress,
        status: 'active',
        createdAt: land.createdAt,
        lastActiveAt: land.createdAt,
      });
    }
  }

  const combinedAccounts = Array.from(accountsMap.values());

  return combinedAccounts
    .map((account) => {
      const lands = getLandsForUser(account, allListings);
      const buyerOrders = getBuyerOrdersForUser(account, allOrders);
      const sellerOrders = getSellerOrdersForUser(account, allListings, allOrders);

      const completedBuyerOrders = buyerOrders.filter((o) => o.status === 'completed');
      const totalPaidUsd = completedBuyerOrders.reduce(
        (sum, o) => sum + getListingPriceUsd(o),
        0,
      );

      return {
        account,
        lands,
        totalLands: lands.length,
        approvedLands: lands.filter((l) => l.approvalStatus === 'approved').length,
        pendingLands: lands.filter((l) => l.approvalStatus === 'pending_review').length,
        rejectedLands: lands.filter((l) => l.approvalStatus === 'rejected').length,
        forSaleLands: lands.filter((l) => l.forSale && l.saleStatus === 'available').length,
        soldLands: lands.filter((l) => l.saleStatus === 'sold').length,
        totalDocuments: lands.reduce((sum, l) => sum + (l.documents?.length ?? 0), 0),
        buyerOrders,
        completedPaymentsCount: completedBuyerOrders.length,
        pendingPaymentsCount: buyerOrders.filter((o) => o.status !== 'completed').length,
        totalPaidUsd,
        sellerOrders,
      };
    })
    .sort((a, b) => b.totalLands - a.totalLands || a.account.fullName.localeCompare(b.account.fullName));
}

export function updateUserAccountStatus(
  userId: string,
  status: 'active' | 'suspended',
): UserAccount[] {
  const accounts = getUserAccounts();
  const exists = accounts.some((u) => u.id === userId);
  let next: UserAccount[];
  if (exists) {
    next = accounts.map((u) => (u.id === userId ? { ...u, status } : u));
  } else {
    const stats = getUserAccountsWithStats().find((s) => s.account.id === userId);
    if (stats) {
      next = [{ ...stats.account, status }, ...accounts];
    } else {
      next = accounts;
    }
  }
  saveUserAccounts(next);
  return next;
}

export function deleteUserAccount(userId: string): UserAccount[] {
  const next = getUserAccounts().filter((u) => u.id !== userId);
  saveUserAccounts(next);
  if (typeof window !== 'undefined') {
    if (localStorage.getItem(ACTIVE_USER_ID_KEY) === userId) {
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
    }
  }
  return next;
}
