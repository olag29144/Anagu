'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Compass,
  FileCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Fingerprint,
  FileText,
} from 'lucide-react';

type RoleType = 'citizen' | 'surveyor' | 'registrar';

interface RoleOption {
  id: RoleType;
  title: string;
  subtitle: string;
  icon: typeof User;
  badge: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    id: 'citizen',
    title: 'Citizen / Landholder',
    subtitle: 'Statutory Applicant',
    icon: User,
    badge: 'DEFAULT',
    description: 'Register and manage Certificates of Occupancy (C of O), Governor Consent, and Deeds of Assignment.',
  },
  {
    id: 'surveyor',
    title: 'Licensed Surveyor',
    subtitle: 'SURCON Registered',
    icon: Compass,
    badge: 'FIELD NODE',
    description: 'Submit beacon coordinates, boundary polygon rings, and PostGIS spatial validation surveys.',
  },
  {
    id: 'registrar',
    title: 'Land Registrar',
    subtitle: 'Ministry Lands Bureau',
    icon: FileCheck,
    badge: 'STATUTORY',
    description: 'Adjudicate title applications, verify dual-oracle attestations, and issue ERC-721 deeds.',
  },
];

const NIGERIAN_STATES = [
  'Lagos State',
  'Federal Capital Territory (Abuja)',
  'Ogun State',
  'Rivers State',
  'Oyo State',
  'Enugu State',
  'Kano State',
  'Kaduna State',
  'Delta State',
  'Edo State',
  'Akwa Ibom State',
  'Anambra State',
  'Imo State',
  'Plateau State',
  'Cross River State',
  'Ondo State',
  'Other State',
];

export default function RegisterPage() {
  const router = useRouter();

  // Form states
  const [selectedRole, setSelectedRole] = useState<RoleType>('citizen');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [jurisdiction, setJurisdiction] = useState('Lagos State');

  // Role-specific fields
  const [ninOrCac, setNinOrCac] = useState('');
  const [surconNumber, setSurconNumber] = useState('');
  const [cadastralFirm, setCadastralFirm] = useState('');
  const [staffId, setStaffId] = useState('');
  const [ministryDept, setMinistryDept] = useState('Directorate of Land Services');

  // Compliance acknowledgment
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const passwordStrength = getPasswordStrength();

  // Fast test fill helper for testing & prototyping
  const handleQuickFill = (role: RoleType) => {
    setSelectedRole(role);
    const rand = Math.floor(Math.random() * 899 + 100);
    if (role === 'citizen') {
      setFullName('Chief Babatunde Adeleke');
      setEmail(`applicant.${rand}@cadastre.ng`);
      setNinOrCac('NIN-89210491823');
    } else if (role === 'surveyor') {
      setFullName('Engr. Chidi Nwosu, mnis');
      setEmail(`surveyor.${rand}@surcon.gov.ng`);
      setSurconNumber('SURCON/2021/4910');
      setCadastralFirm('GeoMatrix Geodetic Consult Ltd');
    } else {
      setFullName('Barr. Fatimah Aliyu');
      setEmail(`registrar.${rand}@lands.gov.ng`);
      setStaffId('LASG/LND/REG/042');
      setMinistryDept('Deeds Registry Directorate');
    }
    setPassword('AnaguCadastre@2026!');
    setConfirmPassword('AnaguCadastre@2026!');
    setAgreedToTerms(true);
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!fullName.trim()) {
      setError('Please enter your full legal name or registered organization.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid official email address.');
      return;
    }
    if (password.length < 8) {
      setError('Security credential must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The security credentials do not match. Please verify.');
      return;
    }
    if (!agreedToTerms) {
      setError('You must accept the Nigerian Land Use Act statutory declaration.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Metadata package to attach to auth user
      const userMetadata: Record<string, string> = {
        full_name: fullName.trim(),
        role: selectedRole,
        jurisdiction,
      };

      if (selectedRole === 'citizen' && ninOrCac) {
        userMetadata.nin_or_cac = ninOrCac.trim();
      } else if (selectedRole === 'surveyor') {
        userMetadata.surcon_number = surconNumber.trim();
        userMetadata.firm_name = cadastralFirm.trim();
      } else if (selectedRole === 'registrar') {
        userMetadata.staff_id = staffId.trim();
        userMetadata.ministry_department = ministryDept.trim();
      }

      // Register with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: userMetadata,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      const user = authData?.user;

      if (user) {
        // Attempt to insert role into user_roles table
        try {
          await (supabase.from('user_roles') as any).insert({
            user_id: user.id,
            role: selectedRole,
          });
        } catch {
          // If RLS prevents direct insert, role remains in user_metadata for role router
        }

        // If session exists immediately (email confirmation disabled or auto-confirmed)
        if (authData.session) {
          router.push('/dashboard');
          router.refresh();
          return;
        }

        // Otherwise confirmation link dispatched
        setSuccessMessage(
          `Cadastral identity created for ${email}. Check your inbox for activation confirmation, or sign in now.`
        );
      } else {
        setSuccessMessage('Registration initiated successfully. Proceed to login.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#020305] text-[#F4F7FB] px-4 py-12 overflow-hidden font-sans">
      {/* Background honeycomb overlay and radial glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[#020305] bg-[url('/assets/honeycomb-background.jpg')] bg-cover bg-center bg-no-repeat opacity-30"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-20 w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0%,rgba(103,232,249,0.05)_35%,transparent_70%)] blur-[90px] -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-10 bottom-10 w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle_at_center,rgba(11,79,120,0.12)_0%,transparent_70%)] blur-[80px] -z-10"
      />

      <div className="relative z-10 w-full max-w-2xl my-6">
        {/* Navigation Bar / Return */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#67E8F9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Cadastre Portal</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#38BDF8] hover:text-[#67E8F9] transition-colors"
          >
            <span>Already registered? Sign In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#0A0F16] border border-[rgba(56,189,248,0.35)] shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-[#38BDF8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
              <polyline points="12 6 12 12 18 15" />
              <circle cx="12" cy="12" r="1.5" fill="#67E8F9" />
            </svg>
          </div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#0A0F16] border border-[rgba(56,189,248,0.25)] text-[10px] font-mono uppercase text-[#67E8F9] mb-2">
            <span>Sovereign Identity Provisioning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F7FB]">
            Register Cadastral Account
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
            Establish cryptographic credentials to interact with state land records, submit surveys, or adjudicate title deeds.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-[12px] bg-[#0A0F16]/90 border border-[rgba(91,133,167,0.22)] p-6 sm:p-8 shadow-[0_0_35px_rgba(56,189,248,0.08)] backdrop-blur-md">
          {/* Quick Fill Preset Buttons */}
          <div className="flex flex-wrap items-center justify-between pb-4 mb-6 border-b border-[rgba(91,133,167,0.16)] gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-[#526174]">Role Matrix</span>
              <span className="text-[11px] font-mono text-[#67E8F9]">LUA &apos;78 RBAC</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#526174] text-[11px] hidden sm:inline">Fill test:</span>
              <button
                type="button"
                onClick={() => handleQuickFill('citizen')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8]/40 transition-colors"
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('surveyor')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8]/40 transition-colors"
              >
                Surveyor
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('registrar')}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#05080D] border border-[rgba(91,133,167,0.25)] text-[#94A3B8] hover:text-[#38BDF8] hover:border-[#38BDF8]/40 transition-colors"
              >
                Registrar
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-6 rounded-[8px] bg-emerald-950/40 border border-emerald-500/40 p-4 text-xs text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold text-sm text-emerald-200">Registration Complete</p>
                <p>{successMessage}</p>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] bg-emerald-500 text-[#020305] font-semibold text-xs hover:bg-emerald-400 transition-colors"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-[8px] bg-rose-950/30 border border-rose-500/40 px-4 py-3 text-xs text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Role Selection Cards */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-3">
                1. Select Account Designation *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ROLES.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-3.5 rounded-[10px] text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#05080D] border-[#38BDF8] shadow-[0_0_18px_rgba(56,189,248,0.18)] ring-1 ring-[#38BDF8]'
                          : 'bg-[#05080D]/60 border-[rgba(91,133,167,0.18)] hover:border-[rgba(56,189,248,0.35)] text-[#94A3B8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-[6px] ${
                            isSelected ? 'bg-[#38BDF8]/15 text-[#38BDF8]' : 'bg-[#0A0F16] text-[#526174]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span
                          className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-[#020305] text-[#67E8F9] border-[#38BDF8]/40'
                              : 'bg-[#020305] text-[#526174] border-[rgba(91,133,167,0.15)]'
                          }`}
                        >
                          {role.badge}
                        </span>
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-[#F4F7FB]' : 'text-[#94A3B8]'
                          }`}
                        >
                          {role.title}
                        </p>
                        <p className="text-[10px] text-[#526174] mt-0.5 line-clamp-2">
                          {role.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Personal & Identity Information */}
            <div className="space-y-4 pt-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
                2. Legal Identity & Jurisdiction *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                  >
                    Full Name / Corporate Entity
                  </label>
                  <div className="relative">
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Chief Babatunde Adeleke"
                      className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                  </div>
                </div>

                {/* Jurisdiction / State */}
                <div>
                  <label
                    htmlFor="jurisdiction"
                    className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                  >
                    State Cadastre Jurisdiction
                  </label>
                  <select
                    id="jurisdiction"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full h-11 px-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st} className="bg-[#0A0F16] text-[#F4F7FB]">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Role-Specific Inputs */}
              {selectedRole === 'citizen' && (
                <div>
                  <label
                    htmlFor="ninOrCac"
                    className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                  >
                    National Identity Number (NIN) / CAC Reg Number
                  </label>
                  <div className="relative">
                    <input
                      id="ninOrCac"
                      type="text"
                      value={ninOrCac}
                      onChange={(e) => setNinOrCac(e.target.value)}
                      placeholder="NIN-00000000000 or RC-000000"
                      className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                    />
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                  </div>
                </div>
              )}

              {selectedRole === 'surveyor' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="surconNumber"
                      className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                    >
                      SURCON License Number *
                    </label>
                    <div className="relative">
                      <input
                        id="surconNumber"
                        type="text"
                        required
                        value={surconNumber}
                        onChange={(e) => setSurconNumber(e.target.value)}
                        placeholder="SURCON/YYYY/0000"
                        className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all font-mono"
                      />
                      <Compass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cadastralFirm"
                      className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                    >
                      Geodetic Firm / Practice Name
                    </label>
                    <div className="relative">
                      <input
                        id="cadastralFirm"
                        type="text"
                        value={cadastralFirm}
                        onChange={(e) => setCadastralFirm(e.target.value)}
                        placeholder="e.g. Apex Survey Consultants"
                        className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                      />
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                    </div>
                  </div>
                </div>
              )}

              {selectedRole === 'registrar' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="staffId"
                      className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                    >
                      Ministry Staff ID / Badge *
                    </label>
                    <div className="relative">
                      <input
                        id="staffId"
                        type="text"
                        required
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        placeholder="LASG/LND/0000"
                        className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all font-mono"
                      />
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="ministryDept"
                      className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                    >
                      Department / Directorate
                    </label>
                    <input
                      id="ministryDept"
                      type="text"
                      value={ministryDept}
                      onChange={(e) => setMinistryDept(e.target.value)}
                      placeholder="Deeds Registry Directorate"
                      className="w-full h-11 px-3.5 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Security Credentials */}
            <div className="space-y-4 pt-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
                3. Security Credentials & Access *
              </label>

              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                >
                  Official Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      selectedRole === 'surveyor'
                        ? 'surveyor@surcon.gov.ng'
                        : selectedRole === 'registrar'
                        ? 'registrar@lands.gov.ng'
                        : 'citizen@domain.com'
                    }
                    className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-mono uppercase text-[#526174]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-[#38BDF8] hover:text-[#67E8F9] flex items-center gap-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border border-[rgba(148,163,184,0.22)] text-sm text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8]/20 transition-all"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-[11px] font-mono uppercase text-[#526174] mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full h-11 pl-10 pr-3 rounded-[8px] bg-[#05080D] border text-sm text-[#F4F7FB] placeholder-[#526174] focus:outline-none focus:ring-2 transition-all ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-rose-500 focus:ring-rose-500/20'
                          : 'border-[rgba(148,163,184,0.22)] focus:border-[#38BDF8] focus:ring-[#38BDF8]/20'
                      }`}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#526174]" />
                  </div>
                </div>
              </div>

              {/* Password strength meter */}
              {password && (
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#526174] mb-1">
                    <span>Credential Complexity</span>
                    <span
                      className={
                        passwordStrength >= 75
                          ? 'text-emerald-400'
                          : passwordStrength >= 50
                          ? 'text-[#38BDF8]'
                          : 'text-amber-400'
                      }
                    >
                      {passwordStrength >= 75 ? 'Strong' : passwordStrength >= 50 ? 'Moderate' : 'Weak'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#05080D] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength >= 75
                          ? 'bg-emerald-400'
                          : passwordStrength >= 50
                          ? 'bg-[#38BDF8]'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Statutory Legal Declaration */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[rgba(148,163,184,0.25)] bg-[#05080D] text-[#38BDF8] focus:ring-[#38BDF8]/20 focus:ring-offset-0 transition-colors"
                />
                <span className="text-xs text-[#94A3B8] leading-relaxed group-hover:text-[#F4F7FB] transition-colors">
                  I solemnly declare that all submitted identity details are authentic. I agree to operate within
                  the statutory provisions of the <strong>Land Use Act (1978)</strong>, the{' '}
                  <strong>Nigeria Data Protection Act (2023)</strong>, and applicable State Cadastral Regulations.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-[8px] bg-[#38BDF8] text-[#020305] text-sm font-semibold border border-[rgba(103,232,249,0.45)] hover:bg-[#67E8F9] hover:shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <div className="h-5 w-5 rounded-full border-2 border-[#020305] border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>Create Cadastral Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-[rgba(91,133,167,0.14)] flex items-center justify-between text-[11px] text-[#526174] font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span>Hyperledger Besu Consortium Registry</span>
            </div>
            <span>Cap L5 LFN 2004</span>
          </div>
        </div>
      </div>
    </main>
  );
}
