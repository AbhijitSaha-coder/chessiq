/**
 * ChessIQ v3.3.0 — High-Performance 6NF Batch Ingestion Module (@DB)
 * Invokes the atomic PL/pgSQL stored procedure `sp_ingest_game_analysis_6nf`
 * with parallel primitive arrays, ensuring single-round-trip persistence in < 50ms.
 */

const logger = require("../utils/logger");

/**
 * Persists an entire game analysis into 6NF irreducible relations via sp_ingest_game_analysis_6nf
 * @param {import('pg').PoolClient | import('pg').Pool} client - Database client or pool
 * @param {Object} payload - Structured analysis payload
 * @param {string} payload.analysisId - UUID of analysis
 * @param {string} payload.gameId - UUID of game
 * @param {number} payload.whiteAcpl - White ACPL
 * @param {number} payload.blackAcpl - Black ACPL
 * @param {number} [payload.whiteBlunders=0] - White blunders
 * @param {number} [payload.whiteMistakes=0] - White mistakes
 * @param {number} [payload.whiteInaccuracies=0] - White inaccuracies
 * @param {number} [payload.blackBlunders=0] - Black blunders
 * @param {number} [payload.blackMistakes=0] - Black mistakes
 * @param {number} [payload.blackInaccuracies=0] - Black inaccuracies
 * @param {number} [payload.engineDepth=14] - Stockfish search depth
 * @param {Array<Object>} payload.moves - Array of move analyses
 * @returns {Promise<{ durationMs: number, moveCount: number, analysisId: string }>}
 */
async function ingestGameAnalysis6NF(client, payload) {
  const start = Date.now();
  const {
    analysisId,
    gameId,
    whiteAcpl,
    blackAcpl,
    whiteBlunders = 0,
    whiteMistakes = 0,
    whiteInaccuracies = 0,
    blackBlunders = 0,
    blackMistakes = 0,
    blackInaccuracies = 0,
    engineDepth = 14,
    moves = [],
  } = payload;

  if (!moves || moves.length === 0) {
    throw new Error("ingestGameAnalysis6NF: moves array cannot be empty.");
  }

  // Deconstruct move objects into parallel primitive arrays
  const plyNumbers = [];
  const moveSans = [];
  const moveUcis = [];
  const fenBefores = [];
  const fenAfters = [];
  const rawEvalTypes = [];
  const rawEvalValues = [];
  const evalCentipawns = [];
  const evalMates = [];
  const cplRaws = [];
  const cplCappeds = [];
  const winProbabilities = [];
  const winProbDeltas = [];
  const bestUcis = [];
  const mistakeTypes = [];
  const phases = [];
  const pvLines = [];
  const isBookMoves = [];

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    plyNumbers.push(m.plyNumber ?? i + 1);
    moveSans.push(m.moveSan ?? m.san ?? "");
    moveUcis.push(m.moveUci ?? m.uci ?? "");
    fenBefores.push(m.fenBefore ?? "");
    fenAfters.push(m.fenAfter ?? "");
    rawEvalTypes.push(m.rawEvalType ?? "cp");
    rawEvalValues.push(m.rawEvalValue ?? 0);
    // Zero-NULL: either centipawn OR mate is present
    evalCentipawns.push(
      m.evalCentipawns !== undefined ? m.evalCentipawns : null,
    );
    evalMates.push(m.evalMate !== undefined ? m.evalMate : null);
    cplRaws.push(m.cplRaw ?? 0);
    cplCappeds.push(m.cplCapped ?? 0);
    winProbabilities.push(m.winProbability ?? 0.5);
    winProbDeltas.push(m.winProbDelta ?? 0);
    bestUcis.push(m.bestMoveUci || null);
    mistakeTypes.push(m.mistakeType ?? "BEST");
    phases.push(m.gamePhase ?? m.phase ?? "OPENING");
    pvLines.push(JSON.stringify(m.pvLine ?? []));
    isBookMoves.push(Boolean(m.isBookMove));
  }

  const queryText = `
    CALL sp_ingest_game_analysis_6nf(
      $1::uuid, $2::uuid, $3::int, $4::int, $5::int, $6::int, $7::int, $8::int, $9::int, $10::int, $11::int,
      $12::int[], $13::varchar[], $14::varchar[], $15::varchar[], $16::varchar[], $17::varchar[], $18::int[],
      $19::int[], $20::int[], $21::int[], $22::int[], $23::numeric[], $24::numeric[], $25::varchar[],
      $26::varchar[], $27::varchar[], $28::jsonb[], $29::boolean[]
    );
  `;

  const params = [
    analysisId,
    gameId,
    whiteAcpl,
    blackAcpl,
    whiteBlunders,
    whiteMistakes,
    whiteInaccuracies,
    blackBlunders,
    blackMistakes,
    blackInaccuracies,
    engineDepth,
    plyNumbers,
    moveSans,
    moveUcis,
    fenBefores,
    fenAfters,
    rawEvalTypes,
    rawEvalValues,
    evalCentipawns,
    evalMates,
    cplRaws,
    cplCappeds,
    winProbabilities,
    winProbDeltas,
    bestUcis,
    mistakeTypes,
    phases,
    pvLines,
    isBookMoves,
  ];

  await client.query(queryText, params);
  const durationMs = Date.now() - start;

  logger.debug(
    {
      analysisId,
      gameId,
      moveCount: moves.length,
      durationMs,
    },
    "High-Performance 6NF Batch Ingestion executed successfully via sp_ingest_game_analysis_6nf",
  );

  return {
    analysisId,
    moveCount: moves.length,
    durationMs,
  };
}

module.exports = {
  ingestGameAnalysis6NF,
};
