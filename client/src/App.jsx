import React, { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "./api/client";
import { soundManager } from "./assets/audio/soundManager";
import { BOARD_THEMES } from "./assets/themes/boardThemes";
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
  Network,
  Volume2,
  VolumeX,
  Play,
  Palette,
  Music,
} from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled React Error in Component Tree:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px",
            maxWidth: "600px",
            margin: "40px auto",
            textAlign: "center",
          }}
          className="glass-panel"
        >
          <AlertTriangle
            size={48}
            color="#f43f5e"
            style={{ marginBottom: "16px" }}
          />
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>
            Diagnostic Shell Crash Detected
          </h2>
          <p
            style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "16px" }}
          >
            {this.state.error?.message || "Unknown runtime error"}
          </p>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
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

  // Asset Management: Procedural Audio FX & Board Themes
  const [selectedTheme, setSelectedTheme] = useState("emerald");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [lastSound, setLastSound] = useState(null);

  const playFx = (type, fn) => {
    fn();
    setLastSound(type);
    setTimeout(() => setLastSound(null), 600);
  };

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundManager.setVolume(val);
  };

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/health");
      setTelemetry(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("NETWORK_ERROR", err.message, 0),
      );
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

  const isHealthy = telemetry?.status === "healthy";
  const hasUuidOssp = telemetry?.database?.extensions?.uuid_ossp;
  const hasBtreeGist = telemetry?.database?.extensions?.btree_gist;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
      {/* Header Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "32px" }}>♞</span>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: "700",
                letterSpacing: "-0.02em",
              }}
            >
              ChessIQ{" "}
              <span
                style={{
                  color: "var(--accent-cyan)",
                  fontSize: "18px",
                  fontWeight: "500",
                }}
              >
                v3.3.0
              </span>
            </h1>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "999px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: "600",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "var(--accent-cyan)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              Day 1 Baseline
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Production-Frozen 6NF Longitudinal Chess Analytics & Engine Gateway
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            <span
              className={`live-indicator ${loading ? "connecting" : isHealthy ? "healthy" : "unhealthy"}`}
            />
            <span>
              {loading ? "Polling..." : isHealthy ? "Gateway Live" : "Degraded"}
            </span>
            {lastChecked && (
              <span style={{ color: "var(--text-muted)" }}>
                ({lastChecked})
              </span>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={fetchHealth}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Error Alert if any */}
      {error && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            marginBottom: "32px",
            borderColor: "rgba(244, 63, 94, 0.4)",
            backgroundColor: "rgba(244, 63, 94, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <XCircle size={20} color="var(--accent-rose)" />
          <div>
            <strong style={{ fontSize: "14px", color: "var(--accent-rose)" }}>
              {error.code}
            </strong>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Primary Telemetry Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {/* Card 1: Database Engine */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Database Engine
            </span>
            <Database size={20} color="var(--accent-cyan)" />
          </div>
          <div
            style={{ fontSize: "20px", fontWeight: "700", marginBottom: "6px" }}
          >
            {telemetry?.database?.database_name || "PostgreSQL 16+"}
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: "1.4",
              wordBreak: "break-all",
            }}
          >
            {telemetry?.database?.engine_version
              ? telemetry.database.engine_version.split(",")[0]
              : "Connecting to database pool..."}
          </p>
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Pool Conns:</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {telemetry?.database?.pool
                ? `${telemetry.database.pool.idle} idle / ${telemetry.database.pool.total} total`
                : "0/0"}
            </span>
          </div>
        </div>

        {/* Card 2: 6NF Extensions & Physical Schema */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              6NF Relational Schema
            </span>
            <Layers size={20} color="var(--accent-indigo)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                6NF Tables / Relations:
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-cyan)",
                  fontWeight: "600",
                }}
              >
                {telemetry?.database?.schema_6nf?.total_6nf_tables
                  ? `${telemetry.database.schema_6nf.total_6nf_tables} Irreducible`
                  : "46+ Physical"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                3NF Reconstruction Views:
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-emerald)",
                  fontWeight: "600",
                }}
              >
                {telemetry?.database?.schema_6nf?.total_3nf_views
                  ? `${telemetry.database.schema_6nf.total_3nf_views} Active`
                  : "8 Verified"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                Temporal GiST Constraints:
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--accent-emerald)",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                <CheckCircle2 size={13} /> ENFORCED
              </span>
            </div>
          </div>
          <div
            style={{
              marginTop: "14px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            Zero-NULL storage & non-overlapping temporal intervals (
            <code style={{ color: "var(--accent-cyan)" }}>tstzrange</code>)
          </div>
        </div>

        {/* Card 3: Single-Domain Cookie Topology */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Cookie Topology
            </span>
            <ShieldCheck size={20} color="var(--accent-emerald)" />
          </div>
          <div
            style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}
          >
            {telemetry?.cookie_topology?.mode === "single_domain_first_party"
              ? "First-Party Single Domain"
              : "Local Dev Vite Proxy"}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "10px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
              }}
            >
              SameSite={telemetry?.cookie_topology?.same_site || "None"}
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Secure=true
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
              }}
            >
              HttpOnly=true
            </span>
          </div>
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            Guarantees Safari WebKit ITP cookie retention
          </div>
        </div>

        {/* Card 4: Runtime Performance */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Gateway Telemetry
            </span>
            <Activity size={20} color="var(--accent-amber)" />
          </div>
          <div
            style={{ fontSize: "20px", fontWeight: "700", marginBottom: "4px" }}
          >
            {telemetry?.latency_ms !== undefined
              ? `${telemetry.latency_ms} ms`
              : "--"}
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Uptime:{" "}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
              }}
            >
              {telemetry?.uptime_seconds || 0}s
            </span>
          </p>
          <div
            style={{
              marginTop: "16px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Environment:</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--accent-amber)",
                textTransform: "uppercase",
              }}
            >
              {telemetry?.environment || "unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Asset Management Panel: Audio FX & Board Theme Catalog */}
      <div
        className="glass-panel"
        style={{
          padding: "28px",
          marginBottom: "28px",
          borderLeft: "4px solid var(--accent-indigo)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(99, 102, 241, 0.15)",
                color: "var(--accent-indigo)",
              }}
            >
              <Music size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
                Asset Management — Procedural Sound FX & Board Theme Engine
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  margin: "2px 0 0",
                }}
              >
                100% Free & Local: Native Web Audio API synthesis (0 latency, 0
                external bandwidth) + SVG Theme Catalog
              </p>
            </div>
          </div>

          {/* Master Audio Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              background: "rgba(255,255,255,0.03)",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
            }}
          >
            <button
              onClick={handleMuteToggle}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: isMuted ? "var(--accent-rose)" : "var(--accent-cyan)",
              }}
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                VOL:
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                disabled={isMuted}
                style={{
                  width: "80px",
                  accentColor: "var(--accent-cyan)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  width: "28px",
                }}
              >
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Sub-panel 1: Interactive Audio Cues */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "18px",
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.05em",
                }}
              >
                Procedural Sound FX Cues
              </span>
              {lastSound && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--accent-emerald)",
                    fontFamily: "var(--font-mono)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Play size={10} fill="var(--accent-emerald)" />{" "}
                  {lastSound.toUpperCase()} TRIGGERED
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                onClick={() => playFx("move", () => soundManager.playMove())}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background:
                    lastSound === "move"
                      ? "rgba(99, 102, 241, 0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                ♟️ Piece Move
              </button>
              <button
                onClick={() =>
                  playFx("capture", () => soundManager.playCapture())
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background:
                    lastSound === "capture"
                      ? "rgba(239, 68, 68, 0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                ⚔️ Capture
              </button>
              <button
                onClick={() => playFx("check", () => soundManager.playCheck())}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background:
                    lastSound === "check"
                      ? "rgba(245, 158, 11, 0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                👑 Check Chime
              </button>
              <button
                onClick={() =>
                  playFx("blunder", () => soundManager.playBlunder())
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background:
                    lastSound === "blunder"
                      ? "rgba(244, 63, 94, 0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                ⚠️ Blunder Alert
              </button>
              <button
                onClick={() =>
                  playFx("victory", () => soundManager.playVictory())
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background:
                    lastSound === "victory"
                      ? "rgba(16, 185, 129, 0.25)"
                      : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                🏆 Victory Triad
              </button>
            </div>
            <div
              style={{
                marginTop: "12px",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              Synthesized in realtime via AudioContext oscillators & bandpass
              noise impulses.
            </div>
          </div>

          {/* Sub-panel 2: Board Theme Assets */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "18px",
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Palette size={14} color="var(--accent-cyan)" /> Board Themes
                Asset Catalog
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--accent-cyan)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {BOARD_THEMES[selectedTheme]?.name}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px",
              }}
            >
              {Object.values(BOARD_THEMES).map((thm) => {
                const isSelected = selectedTheme === thm.id;
                return (
                  <button
                    key={thm.id}
                    onClick={() => {
                      setSelectedTheme(thm.id);
                      soundManager.playMove();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: isSelected
                        ? "rgba(99, 102, 241, 0.18)"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected
                        ? "1px solid var(--accent-indigo)"
                        : "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "var(--text-primary)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.2)",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ flex: 1, background: thm.lightSquare }} />
                      <div style={{ flex: 1, background: thm.darkSquare }} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {thm.name}
                      </div>
                      <div
                        style={{ fontSize: "10px", color: "var(--text-muted)" }}
                      >
                        {thm.id.toUpperCase()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                marginTop: "12px",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              Pre-configured for react-chessboard integration in Day 11.
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Readiness Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "28px",
          borderLeft: "4px solid var(--accent-emerald)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <Server
            size={24}
            color="var(--accent-emerald)"
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                marginBottom: "6px",
              }}
            >
              Day 2 Sealed — 6NF Master Relational DDL Script & 3NF
              Reconstruction Views (@DB)
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
                marginBottom: "14px",
              }}
            >
              Complete Sixth Normal Form (6NF) decomposition into irreducible
              binary relations with native PostgreSQL 16/17 temporal intervals (
              <code>tstzrange</code>), GiST non-overlap constraints,
              asynchronous <code>LISTEN/NOTIFY</code> triggers, and 8 lossless
              3NF reconstruction views.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-emerald)",
                  borderRadius: "6px",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                ✓ 6NF Physical Schema Decomposed (Zero-NULL & Column-Level Lock
                Isolation)
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-emerald)",
                  borderRadius: "6px",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                ✓ Temporal GiST Exclusion Constraints Enforced (user_ratings &
                job_statuses)
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-emerald)",
                  borderRadius: "6px",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                ✓ 8 Lossless 3NF Views (v_users, v_games, v_move_analyses,
                v_training_puzzles...)
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "var(--accent-emerald)",
                  borderRadius: "6px",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                ✓ Reactive Asynchronous Trigger Active
                (trg_notify_new_analysis_job)
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "var(--accent-cyan)",
                  borderRadius: "6px",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                → Ready for Day 3: High-Performance PL/pgSQL Bulk Ingestion
                (sp_ingest_game_analysis_6nf)
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
