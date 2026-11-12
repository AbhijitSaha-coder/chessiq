/**
 * ChessIQ v3.3.0 — Protected Route Guard
 * Day 16 (@FE): Enforces backend session authentication before rendering protected views
 * (Personalized Training Puzzles, Longitudinal Analytics, User Game History).
 * Preserves intended destination across sign-in without losing navigation context.
 */

import React, { useEffect } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./LoginForm";

export default function ProtectedRoute({
  destination,
  destinationLabel,
  onAuthenticatedRedirect,
  children,
}) {
  const {
    isAuthenticated,
    isLoading,
    intendedDestination,
    setIntendedDestination,
  } = useAuth();

  useEffect(() => {
    if (
      !isLoading &&
      !isAuthenticated &&
      destination &&
      intendedDestination !== destination
    ) {
      setIntendedDestination(destination);
    }
  }, [
    isLoading,
    isAuthenticated,
    destination,
    intendedDestination,
    setIntendedDestination,
  ]);

  if (isLoading) {
    return (
      <div
        className="glass-panel"
        role="status"
        aria-busy="true"
        style={{
          padding: "48px 24px",
          textAlign: "center",
          maxWidth: "540px",
          margin: "24px auto",
        }}
      >
        <Shield
          size={28}
          color="var(--accent-cyan)"
          style={{ marginBottom: "12px" }}
        />
        <h3
          style={{ fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}
        >
          Verifying Session Security...
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          Checking active first-party session cookie with ChessIQ API.
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        destinationLabel={destinationLabel}
        onSuccess={() => {
          const target = intendedDestination || destination;
          setIntendedDestination(null);
          if (onAuthenticatedRedirect && target) {
            onAuthenticatedRedirect(target);
          }
        }}
      />
    );
  }

  return <>{children}</>;
}
