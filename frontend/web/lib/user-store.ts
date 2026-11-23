import {
  getLandListings,
  getPurchaseOrders,
  getListingPriceUsd,
  type LandListing,
  type LandPurchaseOrder,
} from './land-store';

export type UserRole = 'user' | 'registrar' | 'governor';

export type InviteCodeRole = 'registrar' | 'governor';

export interface RoleInviteCode {
  id: string;
  code: string;
  role: InviteCodeRole;
  recipientNote?: string;
  status: 'active' | 'used' | 'revoked';
  createdAt: string;
  usedAt?: string;
  usedByUserId?: string;
  usedByName?: string;
  usedByEmail?: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  inviteCodeUsed?: string;
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
const ROLE_CODES_STORAGE_KEY = 'anagu_role_invite_codes_v1';

export const INITIAL_USER_ACCOUNTS: UserAccount[] = [
  {
    id: 'USR-ADELEKE',
    fullName: 'Adeleke Holdings Ltd',
    email: 'estates@adelekeholdings.ng',
    phone: '+234 803 412 8890',
    role: 'user',
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
    role: 'user',
    status: 'active',
    createdAt: '2026-10-05T10:00:00.000Z',
    lastActiveAt: '2026-10-08T11:20:00.000Z',
  },
  {
    id: 'USR-VANGUARD',
    fullName: 'Vanguard Commercial Properties',
    email: 'deals@vanguardprop.ng',
    phone: '+234 802 904 3311',
    role: 'user',
    status: 'active',
    createdAt: '2026-10-10T09:30:00.000Z',
    lastActiveAt: '2026-10-14T16:10:00.000Z',
  },
  {
    id: 'USR-OGUNAGRO',
    fullName: 'Ogun Agro-Allied Ventures',
    email: 'lands@ogunagro.ng',
    phone: '+234 814 550 7219',
    role: 'user',
    status: 'active',
    createdAt: '2026-10-15T12:00:00.000Z',
    lastActiveAt: '2026-10-19T13:40:00.000Z',
  },
  {
    id: 'USR-CRESTLINE',
    fullName: 'Crestline Sovereign Estates',
    email: 'sales@crestlineestates.ng',
    phone: '+234 805 112 6400',
    role: 'user',
    status: 'active',
    createdAt: '2026-10-20T09:00:00.000Z',
    lastActiveAt: '2026-10-25T10:05:00.000Z',
  },
  {
    id: 'USR-ABUJAURBAN',
    fullName: 'Abuja Urban Developments',
    email: 'office@abujadevelopments.ng',
    phone: '+234 807 620 4188',
    role: 'user',
    status: 'active',
    createdAt: '2026-10-22T14:00:00.000Z',
    lastActiveAt: '2026-10-28T08:50:00.000Z',
  },
  {
    id: 'USR-DELTAHORIZON',
    fullName: 'Delta Horizon Realty',
    email: 'registry@deltahorizon.ng',
    phone: '+234 803 884 2201',
    role: 'user',
    status: 'active',
    createdAt: '2026-10-26T11:00:00.000Z',
    lastActiveAt: '2026-11-12T15:20:00.000Z',
  },
  {
    id: 'USR-OYOCORRIDOR',
    fullName: 'Oyo Inland Corridor Partners',
    email: 'info@oyocorridor.ng',
    phone: '+234 812 339 9045',
    role: 'user',
    status: 'active',
    createdAt: '2026-11-01T08:30:00.000Z',
    lastActiveAt: '2026-11-05T09:30:00.000Z',
  },
  {
    id: 'USR-OKAFOR',
    fullName: 'Dr. Chinedu Okafor',
    email: 'c.okafor@medconsult.ng',
    phone: '+234 806 551 0912',
    role: 'user',
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

function normalizeUserRecord(raw: Partial<UserAccount>): UserAccount {
  const role: UserRole =
    raw.role === 'registrar' || raw.role === 'governor' ? raw.role : 'user';
  return {
    ...(raw as UserAccount),
    role,
  };
}

export function getRoleLabel(role?: UserRole): string {
  if (role === 'registrar') return 'Registrar';
  if (role === 'governor') return 'Governor';
  return 'Normal User';
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
      return (parsed as Partial<UserAccount>[]).map(normalizeUserRecord);
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

// ============================================================================
// Admin-Generated Role Invite / Authorization Codes (Registrar & Governor)
// ============================================================================

export function getRoleInviteCodes(): RoleInviteCode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROLE_CODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoleInviteCode[]) : [];
  } catch {
    return [];
  }
}

export function saveRoleInviteCodes(codes: RoleInviteCode[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROLE_CODES_STORAGE_KEY, JSON.stringify(codes));
    window.dispatchEvent(new Event('anagu-codes-changed'));
  } catch {
    // Ignore storage quota errors
  }
}

function createRandomCodeSegment(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function generateRoleInviteCode(
  role: InviteCodeRole,
  recipientNote?: string,
): RoleInviteCode {
  const prefix = role === 'governor' ? 'GOV' : 'REG';
  const existing = getRoleInviteCodes();
  const existingSet = new Set(existing.map((c) => c.code.toUpperCase()));

  let code = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${prefix}-${createRandomCodeSegment(4)}-${createRandomCodeSegment(4)}`;
    if (!existingSet.has(candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    code = `${prefix}-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  const created: RoleInviteCode = {
    id: `CODE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    code,
    role,
    recipientNote: recipientNote?.trim() || undefined,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  saveRoleInviteCodes([created, ...existing]);
  return created;
}

export function revokeRoleInviteCode(codeId: string): RoleInviteCode[] {
  const next = getRoleInviteCodes().map((c) =>
    c.id === codeId && c.status === 'active' ? { ...c, status: 'revoked' as const } : c,
  );
  saveRoleInviteCodes(next);
  return next;
}

export function deleteRoleInviteCode(codeId: string): RoleInviteCode[] {
  const next = getRoleInviteCodes().filter((c) => c.id !== codeId);
  saveRoleInviteCodes(next);
  return next;
}

export function validateRoleInviteCode(
  rawCode: string,
  expectedRole: InviteCodeRole,
): { valid: boolean; invite?: RoleInviteCode; error?: string } {
  const normalized = rawCode.trim().toUpperCase();
  const roleLabel = expectedRole === 'governor' ? 'Governor' : 'Registrar';

  if (!normalized) {
    return {
      valid: false,
      error: `An administrator authorization code is required to register as a ${roleLabel}.`,
    };
  }

  const codes = getRoleInviteCodes();
  const matched = codes.find((c) => c.code.trim().toUpperCase() === normalized);

  if (!matched) {
    return {
      valid: false,
      error: `Invalid ${roleLabel} authorization code. Ask an administrator to generate one in the Admin Console.`,
    };
  }

  if (matched.status === 'used') {
    return {
      valid: false,
      error:
        'This authorization code has expired because it was already used to register an account. Each code works for one account only and cannot be reused.',
    };
  }

  if (matched.status === 'revoked') {
    return {
      valid: false,
      error: 'This authorization code has been revoked by an administrator.',
    };
  }

  if (matched.role !== expectedRole) {
    const actualLabel = matched.role === 'governor' ? 'Governor' : 'Registrar';
    return {
      valid: false,
      error: `This code is only valid for ${actualLabel} registration, not ${roleLabel}.`,
    };
  }

  return { valid: true, invite: matched };
}

function consumeRoleInviteCode(codeId: string, user: UserAccount): void {
  const now = new Date().toISOString();
  const next = getRoleInviteCodes().map((c) =>
    c.id === codeId && c.status === 'active'
      ? {
          ...c,
          status: 'used' as const,
          usedAt: now,
          usedByUserId: user.id,
          usedByName: user.fullName,
          usedByEmail: user.email,
        }
      : c,
  );
  saveRoleInviteCodes(next);
}

export function createUserAccount(input: {
  fullName: string;
  phone: string;
  email?: string;
  walletAddress?: string;
  role?: UserRole;
  inviteCode?: string;
}): { user: UserAccount | null; error: string | null } {
  const requestedRole: UserRole =
    input.role === 'registrar' || input.role === 'governor' ? input.role : 'user';

  let verifiedInvite: RoleInviteCode | undefined;
  if (requestedRole === 'registrar' || requestedRole === 'governor') {
    const check = validateRoleInviteCode(input.inviteCode ?? '', requestedRole);
    if (!check.valid || !check.invite) {
      return { user: null, error: check.error || 'Valid authorization code required.' };
    }
    verifiedInvite = check.invite;
  }

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
    if (requestedRole !== 'user') {
      return {
        user: null,
        error:
          'An account with this email or phone number already exists. Use Sign In to access your existing account — single-use codes only apply to creating a new account.',
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
    role: requestedRole,
    inviteCodeUsed: verifiedInvite?.code,
    walletAddress: input.walletAddress?.trim() || undefined,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([newUser, ...accounts]);
  if (verifiedInvite) {
    consumeRoleInviteCode(verifiedInvite.id, newUser);
  }
  setActiveUserAccount(newUser.id);
  return { user: newUser, error: null };
}

export function signUpOrSignInWithGoogle(input: {
  fullName: string;
  email: string;
  googleId?: string;
  avatarUrl?: string;
  role?: UserRole;
  inviteCode?: string;
}): { user: UserAccount | null; error: string | null } {
  const requestedRole: UserRole =
    input.role === 'registrar' || input.role === 'governor' ? input.role : 'user';

  let verifiedInvite: RoleInviteCode | undefined;
  if (requestedRole === 'registrar' || requestedRole === 'governor') {
    const check = validateRoleInviteCode(input.inviteCode ?? '', requestedRole);
    if (!check.valid || !check.invite) {
      return { user: null, error: check.error || 'Valid authorization code required.' };
    }
    verifiedInvite = check.invite;
  }

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
    if (requestedRole === 'registrar' || requestedRole === 'governor') {
      return {
        user: null,
        error:
          'An account with this Google email already exists. Sign in normally without a code, or use a different Google email to create a new official account.',
      };
    }

    const updated = accounts.map((u) => {
      if (u.id !== existing.id) return u;
      return {
        ...u,
        fullName: u.fullName || input.fullName.trim(),
        authProvider: 'google' as const,
        googleId: input.googleId ?? u.googleId,
        avatarUrl: input.avatarUrl ?? u.avatarUrl,
        lastActiveAt: now,
      };
    });
    saveUserAccounts(updated);
    const active = setActiveUserAccount(existing.id);
    return { user: active, error: null };
  }

  const created: UserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    fullName: input.fullName.trim() || cleanEmail || 'Google User',
    email: cleanEmail,
    phone: 'Not provided',
    role: requestedRole,
    inviteCodeUsed: verifiedInvite?.code,
    authProvider: 'google',
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([created, ...accounts]);
  if (verifiedInvite) {
    consumeRoleInviteCode(verifiedInvite.id, created);
  }
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
    role: 'user',
    walletAddress: input.walletAddress?.trim() || undefined,
    status: 'active',
    createdAt: now,
    lastActiveAt: now,
  };

  saveUserAccounts([created, ...accounts]);
  setActiveUserAccount(created.id);
  return created;
}

export function syncSupabaseUserToLocalProfile(input: {
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  walletAddress?: string;
}): UserAccount {
  const cleanEmail = normalizeEmail(input.email);
  const mappedRole: UserRole =
    input.role === 'registrar' || input.role === 'governor' ? input.role : 'user';
  const accounts = getUserAccounts();
  const existing = accounts.find(
    (u) => cleanEmail !== '' && normalizeEmail(u.email) === cleanEmail,
  );

  if (existing) {
    setActiveUserAccount(existing.id);
    return existing;
  }

  const now = new Date().toISOString();
  const created: UserAccount = {
    id: `USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    fullName: input.fullName?.trim() || cleanEmail.split('@')[0] || 'Anagu User',
    email: cleanEmail || 'Not provided',
    phone: input.phone?.trim() || 'Not provided',
    role: mappedRole,
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
        role: 'user',
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
