import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-green-700">404</h1>
        <p className="mt-2 text-gray-600">Page not found</p>
        <Link
          href="/login"
          className="mt-4 inline-block text-green-700 hover:underline"
        >
          Go to login
        </Link>
      </div>
    </main>
  );
}
