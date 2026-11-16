import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020305] text-[#F4F7FB] px-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold font-mono text-[#38BDF8]">404</h1>
        <p className="text-sm text-[#94A3B8]">The requested page could not be found.</p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/explore"
            className="px-4 py-2 rounded-lg border border-[rgba(91,133,167,0.25)] text-xs text-[#94A3B8] hover:text-[#F4F7FB] transition-colors"
          >
            Explore Land
          </Link>
        </div>
      </div>
    </main>
  );
}
