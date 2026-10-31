/**
 * ChessIQ v3.3.0 — PGN Parsing, Validation & Canonical Move Extraction Service
 * Day 4 (@BE): Parses PGN using chess.js, extracts headers, move history with FEN
 * states (fen_before / fen_after), computes canonical SHA-256 move signature for
 * deduplication, and determines game phase per ply based on remaining material.
 */

const crypto = require("crypto");
const { Chess } = require("chess.js");
const logger = require("../utils/logger");

/**
 * Determines the game phase based on material remaining on the board.
 * Opening: ≤10 half-moves (ply ≤ 10)
 * Endgame: both sides have ≤ 13 non-pawn material points (Q=9, R=5, B=3, N=3)
 * Middlegame: everything else
 *
 * @param {import('chess.js').Chess} chess - Chess instance at the current position
 * @param {number} plyNumber - Current ply number (1-indexed)
 * @returns {'OPENING' | 'MIDDLEGAME' | 'ENDGAME'}
 */
function classifyGamePhase(chess, plyNumber) {
  if (plyNumber <= 10) return "OPENING";

  const board = chess.board();
  const pieceValues = { q: 9, r: 5, b: 3, n: 3 };
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (const row of board) {
    for (const square of row) {
      if (!square || square.type === "k" || square.type === "p") continue;
      const val = pieceValues[square.type] || 0;
      if (square.color === "w") {
        whiteMaterial += val;
      } else {
        blackMaterial += val;
      }
    }
  }

  // Endgame threshold: both sides have ≤ 13 material points (roughly no queens)
  if (whiteMaterial <= 13 && blackMaterial <= 13) return "ENDGAME";
  return "MIDDLEGAME";
}

/**
 * Computes a canonical SHA-256 hash over the normalized SAN move stream.
 * Used for per-user game deduplication (user_game_move_signatures).
 *
 * @param {string[]} sanMoves - Array of SAN move strings (e.g., ["e4", "c5", "Nf3"])
 * @returns {string} 64-character hex SHA-256 digest
 */
function computeMoveSignature(sanMoves) {
  const canonical = sanMoves.join(" ");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Parses a PGN string into structured game data suitable for analysis.
 *
 * @param {string} rawPgn - Raw PGN text (may include headers and move text)
 * @returns {{
 *   headers: Record<string, string>,
 *   moves: Array<{
 *     plyNumber: number,
 *     moveNumber: number,
 *     san: string,
 *     uci: string,
 *     fenBefore: string,
 *     fenAfter: string,
 *     color: 'WHITE' | 'BLACK',
 *     gamePhase: 'OPENING' | 'MIDDLEGAME' | 'ENDGAME'
 *   }>,
 *   totalPlies: number,
 *   moveSignature: string,
 *   rawPgn: string
 * }}
 * @throws {Error} If PGN is invalid or contains no legal moves
 */
function parsePgn(rawPgn) {
  if (!rawPgn || typeof rawPgn !== "string" || rawPgn.trim().length === 0) {
    throw new Error("PGN input is empty or not a string.");
  }

  const chess = new Chess();

  // Attempt to load PGN; chess.js throws on invalid PGN
  try {
    chess.loadPgn(rawPgn.trim());
  } catch (err) {
    throw new Error(`Invalid PGN: ${err.message}`);
  }

  const history = chess.history({ verbose: true });
  if (!history || history.length === 0) {
    throw new Error(
      "PGN contains no legal moves. At least one move is required for analysis.",
    );
  }

  // Extract PGN headers
  const headerObj = chess.header();
  const headers = {};
  if (headerObj) {
    for (const [key, value] of Object.entries(headerObj)) {
      headers[key] = value;
    }
  }

  // Replay the game to capture fen_before and fen_after for every ply
  const replay = new Chess();
  const sanMoves = [];
  const moves = [];

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const plyNumber = i + 1;
    const moveNumber = Math.ceil(plyNumber / 2);
    const color = plyNumber % 2 === 1 ? "WHITE" : "BLACK";

    const fenBefore = replay.fen();

    // Execute the move on the replay board
    replay.move(h.san);

    const fenAfter = replay.fen();
    const gamePhase = classifyGamePhase(replay, plyNumber);

    // Construct UCI from chess.js verbose move
    const uci = h.from + h.to + (h.promotion || "");

    sanMoves.push(h.san);
    moves.push({
      plyNumber,
      moveNumber,
      san: h.san,
      uci,
      fenBefore,
      fenAfter,
      color,
      gamePhase,
    });
  }

  const moveSignature = computeMoveSignature(sanMoves);

  logger.debug(
    {
      totalPlies: moves.length,
      moveSignature: moveSignature.slice(0, 12) + "...",
      whitePlayer: headers.White || "Unknown",
      blackPlayer: headers.Black || "Unknown",
    },
    "PGN parsed successfully",
  );

  return {
    headers,
    moves,
    totalPlies: moves.length,
    moveSignature,
    rawPgn: rawPgn.trim(),
  };
}

/**
 * Resolves which color the authenticated user played based on PGN headers
 * and optional parameterization (user_color / account_handle).
 *
 * Resolution Priority (per spec §8.2):
 * 1. If user_color is explicitly provided → use directly
 * 2. If account_handle is provided → match against White/Black PGN headers
 * 3. If neither → match authenticated username against PGN headers
 * 4. If ambiguous → throw AMBIGUOUS_PLAYER_IDENTITY
 *
 * @param {Record<string, string>} headers - Parsed PGN headers
 * @param {string} username - Authenticated user's username
 * @param {string} [userColor] - Explicit 'WHITE' | 'BLACK' override
 * @param {string} [accountHandle] - Account handle to match against PGN headers
 * @returns {'WHITE' | 'BLACK'}
 * @throws {Error} If player identity cannot be unambiguously resolved
 */
function resolvePlayerColor(headers, username, userColor, accountHandle) {
  // Priority 1: Explicit user_color parameter
  if (userColor) {
    const normalized = userColor.toUpperCase().trim();
    if (normalized === "WHITE" || normalized === "BLACK") {
      return normalized;
    }
    throw new Error(
      `Invalid user_color: "${userColor}". Must be 'WHITE' or 'BLACK'.`,
    );
  }

  const pgnWhite = (headers.White || "").toLowerCase().trim();
  const pgnBlack = (headers.Black || "").toLowerCase().trim();

  // Priority 2: Match account_handle against PGN headers
  if (accountHandle) {
    const handle = accountHandle.toLowerCase().trim();
    if (pgnWhite === handle) return "WHITE";
    if (pgnBlack === handle) return "BLACK";
    throw new Error(
      `Account handle "${accountHandle}" does not match PGN White ("${headers.White}") or Black ("${headers.Black}") headers.`,
    );
  }

  // Priority 3: Match authenticated username against PGN headers
  const user = username.toLowerCase().trim();
  if (pgnWhite === user) return "WHITE";
  if (pgnBlack === user) return "BLACK";

  // Priority 4: Ambiguous — cannot resolve
  throw new Error(
    `Authenticated user "${username}" does not match PGN White ("${headers.White}") or Black ("${headers.Black}") headers. Please specify user_color ('WHITE' | 'BLACK') or account_handle.`,
  );
}

module.exports = {
  parsePgn,
  computeMoveSignature,
  resolvePlayerColor,
  classifyGamePhase,
};
