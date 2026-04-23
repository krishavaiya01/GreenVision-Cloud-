import React, { useEffect, useMemo, useState } from 'react';
import { cloudLogsApi } from '../../../services/api/cloudLogsApi';

export default function AwsIssueLogsCard({ sinceMinutes = 60, limit = 100, refreshSec = 30 }) {
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState(''); // '', 'error', 'warn'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cloudLogsApi.getAwsIssueLogs({ level: level || undefined, sinceMinutes, limit });
      setLogs(data);
    } catch (e) {
      setError(e?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const t = setInterval(fetchLogs, refreshSec * 1000);
    return () => clearInterval(t);
  }, [level, sinceMinutes, limit, refreshSec]);

  const rows = useMemo(() => (logs || []).slice(0, limit), [logs, limit]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, backdropFilter: 'blur(6px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>AWS Issue Logs</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8 }}>
            <option value=''>All</option>
            <option value='error'>Error</option>
            <option value='warn'>Warn</option>
          </select>
          <button onClick={fetchLogs} disabled={loading} style={{ padding: '6px 10px', borderRadius: 8 }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && (
        <div style={{ color: '#ff6b6b', marginBottom: 8 }}>Error: {error}</div>
      )}
      {rows.length === 0 && !loading && (
        <div style={{ opacity: 0.8 }}>No issues found in the last {sinceMinutes} min.</div>
      )}
      <div style={{ maxHeight: 260, overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {rows.map((l) => (
          <div key={l.eventId} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{new Date(l.timestamp).toLocaleString()}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6, background: l.level === 'error' ? 'rgba(255, 77, 79, 0.2)' : 'rgba(250, 219, 20, 0.2)' }}>
                {l.level?.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, opacity: 0.9 }}>{l.logGroup}</span>
              {l.logStream && <span style={{ fontSize: 12, opacity: 0.7 }}>• {l.logStream}</span>}
            </div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.35 }}>{l.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
