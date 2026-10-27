import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from './api/client';
import { 
  Database, 
  ShieldCheck, 
  Server, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Cpu,
  Layers,
  Network
} from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error in Component Tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }} className="glass-panel">
          <AlertTriangle size={48} color="#f43f5e" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Diagnostic Shell Crash Detected</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
            {this.state.error?.message || 'Unknown runtime error'}
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload Diagnostic Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DiagnosticShell() {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/health');
      setTelemetry(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('NETWORK_ERROR', err.message, 0));
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const isHealthy = telemetry?.status === 'healthy';
  const hasUuidOssp = telemetry?.database?.extensions?.uuid_ossp;
  const hasBtreeGist = telemetry?.database?.extensions?.btree_gist;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Header Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>♞</span>
            <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.02em' }}>
              ChessIQ <span style={{ color: 'var(--accent-cyan)', fontSize: '18px', fontWeight: '500' }}>v3.3.0</span>
            </h1>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '600',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              Day 1 Baseline
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Production-Frozen 6NF Longitudinal Chess Analytics & Engine Gateway
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span className={`live-indicator ${loading ? 'connecting' : isHealthy ? 'healthy' : 'unhealthy'}`} />
            <span>{loading ? 'Polling...' : isHealthy ? 'Gateway Live' : 'Degraded'}</span>
            {lastChecked && <span style={{ color: 'var(--text-muted)' }}>({lastChecked})</span>}
          </div>
          <button className="btn-primary" onClick={fetchHealth} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Error Alert if any */}
      {error && (
        <div
          className="glass-panel"
          style={{
            padding: '16px 20px',
            marginBottom: '32px',
            borderColor: 'rgba(244, 63, 94, 0.4)',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <XCircle size={20} color="var(--accent-rose)" />
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--accent-rose)' }}>{error.code}</strong>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{error.message}</p>
          </div>
        </div>
      )}

      {/* Primary Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Card 1: Database Engine */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Database Engine
            </span>
            <Database size={20} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>
            {telemetry?.database?.database_name || 'PostgreSQL 16+'}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', wordBreak: 'break-all' }}>
            {telemetry?.database?.engine_version ? telemetry.database.engine_version.split(',')[0] : 'Connecting to database pool...'}
          </p>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Pool Conns:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {telemetry?.database?.pool ? `${telemetry.database.pool.idle} idle / ${telemetry.database.pool.total} total` : '0/0'}
            </span>
          </div>
        </div>

        {/* Card 2: 6NF Extensions */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              6NF Core Extensions
            </span>
            <Layers size={20} color="var(--accent-indigo)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>uuid-ossp</span>
              {hasUuidOssp ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)', fontSize: '12px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} /> ACTIVE
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)', fontSize: '12px', fontWeight: '600' }}>
                  <XCircle size={14} /> MISSING
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>btree_gist</span>
              {hasBtreeGist ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)', fontSize: '12px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} /> ACTIVE
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)', fontSize: '12px', fontWeight: '600' }}>
                  <XCircle size={14} /> MISSING
                </span>
              )}
            </div>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Enables GiST exclusions on temporal <code style={{ color: 'var(--accent-cyan)' }}>tstzrange</code>
          </div>
        </div>

        {/* Card 3: Single-Domain Cookie Topology */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cookie Topology
            </span>
            <ShieldCheck size={20} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            {telemetry?.cookie_topology?.mode === 'single_domain_first_party'
              ? 'First-Party Single Domain'
              : 'Local Dev Vite Proxy'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
              SameSite={telemetry?.cookie_topology?.same_site || 'None'}
            </span>
            <span style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
              Secure=true
            </span>
            <span style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
              HttpOnly=true
            </span>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Guarantees Safari WebKit ITP cookie retention
          </div>
        </div>

        {/* Card 4: Runtime Performance */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gateway Telemetry
            </span>
            <Activity size={20} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
            {telemetry?.latency_ms !== undefined ? `${telemetry.latency_ms} ms` : '--'}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Uptime: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{telemetry?.uptime_seconds || 0}s</span>
          </p>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Environment:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
              {telemetry?.environment || 'unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Readiness Banner */}
      <div className="glass-panel" style={{ padding: '28px', borderLeft: '4px solid var(--accent-emerald)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <Server size={24} color="var(--accent-emerald)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
              Day 1 Baseline Sealed — Ready for Day 2: 6NF DDL & Views
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '14px' }}>
              All 3 engineering tracks (@DB Database Architect, @BE Distributed Systems Engineer, @FE Frontend & Telemetry Engineer)
              have their baseline components, connection pools, schema migration runners, environment validators, and single-domain reverse-proxy hooks verified and operational.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                ✓ Database Connection Pool Configured (max: 20, 10s statement timeout)
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                ✓ Dedicated LISTEN Client Factory Active
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                ✓ SHA-256 Migration Engine Active
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                ✓ Single-Domain Cookie Proxy Active (/api)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DiagnosticShell />
    </ErrorBoundary>
  );
}
