import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface DemoAccount {
  email: string;
  role: 'citizen' | 'surveyor' | 'registrar' | 'land_admin' | 'governor';
  name: string;
  title: string;
  department: string;
  description: string;
  defaultPath: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'citizen@anagu.gov.ng',
    role: 'citizen',
    name: 'Chief Babatunde Adeleke',
    title: 'Statutory Applicant / Landholder',
    department: 'Private Titleholder (Lagos Cadastre)',
    description: 'Submit C of O applications, track pipeline validation, and view registered deeds.',
    defaultPath: '/citizen',
  },
  {
    email: 'registrar@anagu.gov.ng',
    role: 'registrar',
    name: 'Barr. Fatimah Aliyu',
    title: 'Deeds Registrar',
    department: 'Ministry of Lands Bureau',
    description: 'Adjudicate title applications, inspect PostGIS hashes, and issue ERC-721 deeds.',
    defaultPath: '/registrar',
  },
  {
    email: 'admin@anagu.gov.ng',
    role: 'land_admin',
    name: 'Dr. Ibrahim Danladi',
    title: 'Land Administrator',
    department: 'State Directorate of Land Services',
    description: 'Overview of all cadastral applications, issued NFT titles, and legal audits.',
    defaultPath: '/admin',
  },
  {
    email: 'governor@anagu.gov.ng',
    role: 'governor',
    name: 'His Excellency Governor Sanwo-Olu',
    title: 'Executive Governor',
    department: 'State Executive Council (Land Use Act §28)',
    description: 'Statutory title revocation under Overriding Public Interest and condition breaches.',
    defaultPath: '/governor',
  },
  {
    email: 'surveyor@anagu.gov.ng',
    role: 'surveyor',
    name: 'Engr. Chidi Nwosu, mnis',
    title: 'Licensed Surveyor',
    department: 'SURCON Registered Survey Consult',
    description: 'Submit beacon coordinates, boundary polygon rings, and PostGIS spatial validation surveys.',
    defaultPath: '/citizen',
  },
];

const STORAGE_KEY_APPLICATIONS = 'anagu_demo_applications_v1';
const STORAGE_KEY_TITLES = 'anagu_demo_titles_v1';
const STORAGE_KEY_AUDIT = 'anagu_demo_audit_v1';

const INITIAL_APPLICATIONS = [
  {
    id: 'APP-2026-0891',
    citizen_id: 'demo-user-citizen',
    owner_name: 'Chief Babatunde Adeleke',
    parcel_ref: 'LAG-ETI-2026-00412',
    status: 'in_review',
    spatial_hash: '0x9a4f21b7c8e31a8904e28bb1829e0811b7',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    document_number: 'SURV/2026/0412',
    document_type: 'Certificate of Occupancy (C of O)',
  },
  {
    id: 'APP-2026-0889',
    citizen_id: 'demo-user-citizen',
    owner_name: 'Dr. Ngozi Okonjo-Eze',
    parcel_ref: 'ABJ-AMAC-2026-01189',
    status: 'legal_pending',
    spatial_hash: null,
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    document_number: 'GOV/CONSENT/2026/01189',
    document_type: 'Governor Consent',
  },
  {
    id: 'APP-2026-0875',
    citizen_id: 'demo-user-citizen',
    owner_name: 'Chief Babatunde Adeleke',
    parcel_ref: 'RIV-PHC-2026-00742',
    status: 'approved',
    spatial_hash: '0x4f19bc321ae83719918bc28919f91a',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    document_number: 'DEED/2025/9981',
    document_type: 'Deed of Assignment',
  },
  {
    id: 'APP-2026-0860',
    citizen_id: 'demo-user-citizen',
    owner_name: 'Alhaji Musa Dangote',
    parcel_ref: 'OGN-IKN-2026-00318',
    status: 'pending',
    spatial_hash: null,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    document_number: 'SURV/2025/1102',
    document_type: 'Right of Occupancy (R of O)',
  },
];

const INITIAL_TITLES = [
  {
    id: 'TITLE-NFT-1041',
    token_id: '1041',
    status: 'active',
    issued_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    parcel_ref: 'LAG-ETI-2026-00412',
    owner_address: '0x71C83812a19f20108A',
  },
  {
    id: 'TITLE-NFT-1042',
    token_id: '1042',
    status: 'active',
    issued_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    parcel_ref: 'RIV-PHC-2026-00742',
    owner_address: '0x89AB12c31b87a0018b',
  },
  {
    id: 'TITLE-NFT-1039',
    token_id: '1039',
    status: 'revoked',
    issued_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    parcel_ref: 'KAN-KMC-2025-00109',
    owner_address: '0x14E78b401829e187',
  },
];

export function getStoredApplications(): typeof INITIAL_APPLICATIONS {
  if (typeof window === 'undefined') return INITIAL_APPLICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APPLICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(INITIAL_APPLICATIONS));
      return INITIAL_APPLICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_APPLICATIONS;
  }
}

export function saveStoredApplications(apps: typeof INITIAL_APPLICATIONS) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(apps));
    } catch {
      // Ignore quota error
    }
  }
}

export function getStoredTitles(): typeof INITIAL_TITLES {
  if (typeof window === 'undefined') return INITIAL_TITLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TITLES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TITLES, JSON.stringify(INITIAL_TITLES));
      return INITIAL_TITLES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TITLES;
  }
}

export function saveStoredTitles(titles: typeof INITIAL_TITLES) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_TITLES, JSON.stringify(titles));
    } catch {
      // Ignore quota error
    }
  }
}

export function getActiveDemoAccount(): DemoAccount | null {
  if (typeof window === 'undefined') return null;
  const cookieMatch = document.cookie.match(/anagu_demo_role=([^;]+)/);
  const role = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  if (!role) return null;
  return DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
}

export function setDemoSession(account: DemoAccount) {
  if (typeof window === 'undefined') return;
  const maxAge = 86400 * 7; // 7 days
  document.cookie = `anagu_demo_role=${account.role}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `anagu_demo_user=${encodeURIComponent(account.email)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `anagu_demo_name=${encodeURIComponent(account.name)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearDemoSession() {
  if (typeof window === 'undefined') return;
  document.cookie = 'anagu_demo_role=; path=/; max-age=0';
  document.cookie = 'anagu_demo_user=; path=/; max-age=0';
  document.cookie = 'anagu_demo_name=; path=/; max-age=0';
  try {
    localStorage.removeItem('anagu_demo_session');
  } catch {
    // Ignore
  }
}

interface MockQueryBuilder<T> {
  select: (cols?: string) => MockQueryBuilder<T>;
  eq: (col: string, val: unknown) => MockQueryBuilder<T>;
  in: (col: string, vals: unknown[]) => MockQueryBuilder<T>;
  order: (col: string, opts?: { ascending?: boolean }) => MockQueryBuilder<T>;
  maybeSingle: () => Promise<{ data: T | null; error: null }>;
  single: () => Promise<{ data: T | null; error: null }>;
  then: (onfulfilled?: (res: { data: T[]; error: null }) => unknown) => Promise<unknown>;
}

function createMockQuery<T extends Record<string, unknown>>(dataList: T[]): MockQueryBuilder<T> {
  let filtered = [...dataList];

  const builder: MockQueryBuilder<T> = {
    select() {
      return builder;
    },
    eq(col, val) {
      filtered = filtered.filter((item) => String(item[col]) === String(val));
      return builder;
    },
    in(col, vals) {
      const set = new Set(vals.map(String));
      filtered = filtered.filter((item) => set.has(String(item[col])));
      return builder;
    },
    order(col, opts = { ascending: true }) {
      filtered.sort((a, b) => {
        const valA = a[col] ?? '';
        const valB = b[col] ?? '';
        if (valA < valB) return opts.ascending ? -1 : 1;
        if (valA > valB) return opts.ascending ? 1 : -1;
        return 0;
      });
      return builder;
    },
    async maybeSingle() {
      return { data: filtered[0] ?? null, error: null };
    },
    async single() {
      return { data: filtered[0] ?? null, error: null };
    },
    then(onfulfilled) {
      const res = { data: filtered, error: null };
      return Promise.resolve(onfulfilled ? onfulfilled(res) : res);
    },
  };

  return builder;
}

let realClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  const isDemo = typeof window !== 'undefined' && Boolean(getActiveDemoAccount());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  if (!realClient) {
    realClient = createSupabaseClient(url, anonKey);
  }

  const activeDemo = getActiveDemoAccount();

  // If a demo account is active or if Supabase is unconfigured, return demo wrapper
  if (isDemo && activeDemo) {
    const demoUser = {
      id: `demo-user-${activeDemo.role}`,
      email: activeDemo.email,
      app_metadata: { role: activeDemo.role },
      user_metadata: {
        role: activeDemo.role,
        full_name: activeDemo.name,
        jurisdiction: 'Lagos State',
      },
      role: 'authenticated',
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const demoSession = {
      access_token: 'mock-jwt-token-' + activeDemo.role,
      token_type: 'bearer',
      user: demoUser,
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
    };

    return {
      auth: {
        async getSession() {
          return { data: { session: demoSession }, error: null };
        },
        async getUser() {
          return { data: { user: demoUser }, error: null };
        },
        async signInWithPassword({ email }: { email: string; password?: string }) {
          const match = DEMO_ACCOUNTS.find(
            (a) => a.email.toLowerCase() === email.toLowerCase() || a.role === email.toLowerCase(),
          ) ?? activeDemo;
          setDemoSession(match);
          return { data: { user: demoUser, session: demoSession }, error: null };
        },
        async signOut() {
          clearDemoSession();
          return { error: null };
        },
        onAuthStateChange(callback: (event: string, session: typeof demoSession | null) => void) {
          callback('SIGNED_IN', demoSession);
          return {
            data: {
              subscription: {
                unsubscribe: () => {},
              },
            },
          };
        },
      },
      from(table: string) {
        if (table === 'applications') {
          return createMockQuery(getStoredApplications());
        }
        if (table === 'land_titles') {
          return createMockQuery(getStoredTitles());
        }
        if (table === 'user_roles') {
          return createMockQuery([{ user_id: demoUser.id, role: activeDemo.role }]);
        }
        return createMockQuery([]);
      },
    } as unknown as ReturnType<typeof createSupabaseClient>;
  }

  // Not in active demo session — provide login interception for demo emails
  return {
    ...realClient,
    auth: {
      ...realClient.auth,
      async signInWithPassword({ email, password }: { email: string; password?: string }) {
        const cleanEmail = email.trim().toLowerCase();
        // Check if user entered a demo account email or role name
        const demoMatch = DEMO_ACCOUNTS.find(
          (a) =>
            a.email.toLowerCase() === cleanEmail ||
            a.role === cleanEmail ||
            cleanEmail.includes(a.role),
        );

        if (demoMatch) {
          setDemoSession(demoMatch);
          const demoUser = {
            id: `demo-user-${demoMatch.role}`,
            email: demoMatch.email,
            app_metadata: { role: demoMatch.role },
            user_metadata: {
              role: demoMatch.role,
              full_name: demoMatch.name,
              jurisdiction: 'Lagos State',
            },
          };
          return {
            data: {
              user: demoUser,
              session: {
                access_token: 'mock-jwt-token-' + demoMatch.role,
                user: demoUser,
              },
            },
            error: null,
          };
        }

        // Otherwise try real Supabase
        try {
          return await realClient!.auth.signInWithPassword({ email, password: password || '' });
        } catch (err) {
          return {
            data: { user: null, session: null },
            error: new Error(
              err instanceof Error ? err.message : 'Authentication failed. Try using a demo account.',
            ),
          };
        }
      },
    },
    from(table: string) {
      if (url.includes('placeholder.supabase.co')) {
        if (table === 'applications') return createMockQuery(getStoredApplications());
        if (table === 'land_titles') return createMockQuery(getStoredTitles());
        if (table === 'user_roles') return createMockQuery([]);
        return createMockQuery([]);
      }
      return realClient!.from(table);
    },
  } as unknown as ReturnType<typeof createSupabaseClient>;
}
