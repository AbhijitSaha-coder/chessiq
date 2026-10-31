/**
 * ChessIQ v3.3.0 — UCI Protocol Parser & Stockfish Communication Module
 * Day 5 (@BE): Handles bidirectional UCI (Universal Chess Interface) protocol
 * communication with the Stockfish NNUE child process.
 *
 * Responsibilities:
 * - Parsing "info" lines for score, depth, pv, nodes, time
 * - Parsing "bestmove" responses
 * - Constructing UCI position and go commands
 * - Detecting "readyok" and "uciok" handshake responses
 */

const logger = require("../utils/logger");

/**
 * Parses a Stockfish "info" line and extracts evaluation data.
 *
 * Example input:
 *   "info depth 14 seldepth 18 multipv 1 score cp 32 nodes 48123 time 120 pv e2e4 e7e5 g1f3"
 *   "info depth 14 seldepth 20 multipv 1 score mate 3 nodes 51234 time 130 pv e7e8q b1a1 e8e1"
 *
 * @param {string} line - Raw UCI info line from Stockfish stdout
 * @returns {Object|null} Parsed evaluation data or null if not a valid info line
 */
function parseInfoLine(line) {
  if (!line || !line.startsWith("info ")) return null;

  // Skip non-evaluation info lines (e.g., "info string ...")
  if (line.includes("info string")) return null;

  const tokens = line.split(/\s+/);
  const result = {
    depth: null,
    seldepth: null,
    multipv: null,
    score: null,
    nodes: null,
    time: null,
    pv: [],
  };

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case "depth":
        result.depth = parseInt(tokens[++i], 10);
        break;
      case "seldepth":
        result.seldepth = parseInt(tokens[++i], 10);
        break;
      case "multipv":
        result.multipv = parseInt(tokens[++i], 10);
        break;
      case "score":
        i++;
        if (tokens[i] === "cp") {
          result.score = { type: "cp", value: parseInt(tokens[++i], 10) };
        } else if (tokens[i] === "mate") {
          result.score = { type: "mate", value: parseInt(tokens[++i], 10) };
        }
        break;
      case "nodes":
        result.nodes = parseInt(tokens[++i], 10);
        break;
      case "time":
        result.time = parseInt(tokens[++i], 10);
        break;
      case "pv": {
        // Collect all remaining tokens as the PV line
        const pvMoves = [];
        for (let j = i + 1; j < tokens.length; j++) {
          // PV ends at the next keyword or end of line
          if (
            [
              "depth",
              "seldepth",
              "multipv",
              "score",
              "nodes",
              "time",
              "bmc",
              "tbhits",
              "hashfull",
              "nps",
              "currmove",
              "currmovenumber",
            ].includes(tokens[j])
          ) {
            break;
          }
          pvMoves.push(tokens[j]);
        }
        result.pv = pvMoves;
        i = tokens.length; // End loop after PV
        break;
      }
    }
  }

  // Only return if we got meaningful evaluation data
  if (result.score !== null) {
    return result;
  }

  return null;
}

/**
 * Parses a Stockfish "bestmove" line.
 *
 * Example: "bestmove e2e4 ponder e7e5"
 *
 * @param {string} line - Raw bestmove line
 * @returns {{ bestmove: string, ponder: string|null }|null}
 */
function parseBestMove(line) {
  if (!line || !line.startsWith("bestmove")) return null;

  const tokens = line.split(/\s+/);
  return {
    bestmove: tokens[1] || null,
    ponder: tokens[3] || null,
  };
}

/**
 * Constructs a UCI "position" command from a FEN string.
 *
 * @param {string} fen - FEN position string
 * @returns {string} UCI position command
 */
function buildPositionCommand(fen) {
  return `position fen ${fen}`;
}

/**
 * Constructs a UCI "go" command with the specified search depth.
 *
 * @param {number} depth - Search depth in plies
 * @returns {string} UCI go command
 */
function buildGoCommand(depth) {
  return `go depth ${depth}`;
}

/**
 * Checks if a line is a "readyok" response.
 * @param {string} line
 * @returns {boolean}
 */
function isReadyOk(line) {
  return line && line.trim() === "readyok";
}

/**
 * Checks if a line is a "uciok" response.
 * @param {string} line
 * @returns {boolean}
 */
function isUciOk(line) {
  return line && line.trim() === "uciok";
}

/**
 * Checks if a line is a "bestmove" response.
 * @param {string} line
 * @returns {boolean}
 */
function isBestMove(line) {
  return line && line.trim().startsWith("bestmove");
}

module.exports = {
  parseInfoLine,
  parseBestMove,
  buildPositionCommand,
  buildGoCommand,
  isReadyOk,
  isUciOk,
  isBestMove,
};
