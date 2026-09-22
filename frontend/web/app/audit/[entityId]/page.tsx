import { createServerSupabaseClient } from '@/lib/supabase-server';

interface AuditEntry {
  id: string;
  entity_id: string;
  actor_id: string | null;
  action: string;
  outcome: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default async function AuditTrailPage({ params }: { params: { entityId: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: entries } = await supabase
    .from('audit_trail')
    .select('*')
    .eq('entity_id', params.entityId)
    .order('created_at', { ascending: true });

  const outcomeColor = (o: string) =>
    o.includes('APPROVED') || o.includes('Verified') ? 'text-green-600'
    : o.includes('REJECTED') || o.includes('Conflict') ? 'text-red-600'
    : 'text-yellow-600';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Trail</h1>
      <p className="text-sm text-gray-500 mb-6">
        Entity: <code className="bg-gray-100 px-1 rounded">{params.entityId}</code>
      </p>

      {(!entries || entries.length === 0) && (
        <p className="text-gray-400">No audit entries found.</p>
      )}

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-4">
          {(entries as AuditEntry[]).map((e) => (
            <div
              key={e.id}
              className="relative ml-10 bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="absolute -left-6 top-4 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold text-gray-800">{e.action}</span>
                  <span className={`ml-2 text-sm font-medium ${outcomeColor(e.outcome)}`}>
                    {e.outcome}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.actor_id && (
                <p className="text-xs text-gray-500 mt-1">Actor: {e.actor_id}</p>
              )}
              {Object.keys(e.metadata ?? {}).length > 0 && (
                <pre className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-auto text-gray-600">
                  {JSON.stringify(e.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
