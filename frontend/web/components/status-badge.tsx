/**
 * StatusBadge — reusable colored pill for application/title statuses.
 *
 * Supported statuses:
 *   pending     → gray
 *   in_review   → yellow/amber
 *   approved    → blue
 *   completed   → green
 *   rejected    → red
 *   active      → green (for land titles)
 *   revoked     → red   (for land titles)
 */

export type ApplicationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'active'
  | 'revoked';

interface StatusBadgeProps {
  status: ApplicationStatus | string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-700 ring-gray-200',
  in_review: 'bg-amber-100 text-amber-700 ring-amber-200',
  approved:  'bg-blue-100 text-blue-700 ring-blue-200',
  completed: 'bg-green-100 text-green-700 ring-green-200',
  rejected:  'bg-red-100 text-red-700 ring-red-200',
  active:    'bg-green-100 text-green-700 ring-green-200',
  revoked:   'bg-red-100 text-red-700 ring-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  in_review: 'In Review',
  approved:  'Approved',
  completed: 'Completed',
  rejected:  'Rejected',
  active:    'Active',
  revoked:   'Revoked',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalised = status?.toLowerCase().replace(/ /g, '_') ?? 'pending';
  const styles = STATUS_STYLES[normalised] ?? 'bg-gray-100 text-gray-700 ring-gray-200';
  const label = STATUS_LABELS[normalised] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles} ${className}`}
    >
      {label}
    </span>
  );
}
