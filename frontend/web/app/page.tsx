import { redirect } from 'next/navigation';

/**
 * Landing page — immediately redirects to login.
 * Role-based routing happens after login via /dashboard.
 */
export default function HomePage() {
  redirect('/login');
}
