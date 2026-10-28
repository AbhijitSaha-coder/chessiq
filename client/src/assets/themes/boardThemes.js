/**
 * ChessIQ v3.3.0 — Board & Visual Theme Asset Manager
 * Zero-dependency, customizable board styles & telemetry palettes.
 */

export const BOARD_THEMES = {
  emerald: {
    id: "emerald",
    name: "Tournament Emerald",
    lightSquare: "#eaebd0",
    darkSquare: "#779556",
    highlight: "rgba(247, 247, 105, 0.5)",
    blunder: "rgba(239, 68, 68, 0.55)",
  },
  ocean: {
    id: "ocean",
    name: "Grandmaster Ocean",
    lightSquare: "#dee3e6",
    darkSquare: "#8ca2ad",
    highlight: "rgba(6, 182, 212, 0.5)",
    blunder: "rgba(244, 63, 94, 0.55)",
  },
  walnut: {
    id: "walnut",
    name: "Classical Walnut",
    lightSquare: "#e0c49f",
    darkSquare: "#9c6644",
    highlight: "rgba(245, 158, 11, 0.5)",
    blunder: "rgba(220, 38, 38, 0.55)",
  },
  oled: {
    id: "oled",
    name: "Cyberpunk Dark",
    lightSquare: "#2a2e39",
    darkSquare: "#15181f",
    highlight: "rgba(99, 102, 241, 0.5)",
    blunder: "rgba(244, 63, 94, 0.6)",
  },
};

export const DEFAULT_BOARD_THEME = BOARD_THEMES.emerald;
