/**
 * ChessIQ v3.3.0 — Day 6 Unit & Mathematical Verification Suite (@BE)
 *
 * Verifies:
 * 1. Formal Polarity Inversion (§11.2): Eval_played_mover = -1 × Eval(fen_after)
 * 2. Continuous Mate Mapping (§11.3): Eval(mate M) = ±10000 ∓ (M × 100)
 * 3. Centipawn Loss Math (§11.2): CPL_raw = max(0, Eval_best - Eval_played), CPL_capped = min(1000, CPL_raw)
 * 4. Logistic Win Probability (§11.4): W(cp) = 1 / (1 + 10^(-cp / 400))
 * 5. Six-Tier Mistake Classification (§11.4): BEST, GOOD, INACCURACY, MISTAKE, BLUNDER, MISSED_WIN
 * 6. Opening Book ACPL Exclusion (§11.5)
 */

const {
  mateToCentipawns,
  invertEvaluation,
  winProbability,
  computeCentipawnLoss,
  classifyMove,
  computeACPL,
  normalizeRawEval,
  evalToCentipawns,
} = require("../src/engine/evalMath");

describe("Day 6: Formalized Engine Evaluation Mathematics (@BE)", () => {
  // ==========================================================================
  // §11.3 — Continuous Mate Mapping
  // ==========================================================================
  describe("§11.3 Continuous Mate Mapping", () => {
    it("maps positive mate distance (mover mates) to high positive centipawns", () => {
      // Mate in 1: +10000 - (1 * 100) = +9900
      expect(mateToCentipawns(1)).toBe(9900);

      // Mate in 2: +10000 - (2 * 100) = +9800 (from spec §11.3 example)
      expect(mateToCentipawns(2)).toBe(9800);

      // Mate in 5: +10000 - (5 * 100) = +9500
      expect(mateToCentipawns(5)).toBe(9500);

      // Faster mate is worth more than slower mate
      expect(mateToCentipawns(1)).toBeGreaterThan(mateToCentipawns(2));
      expect(mateToCentipawns(2)).toBeGreaterThan(mateToCentipawns(5));
    });

    it("maps negative mate distance (opponent mates) to high negative centipawns", () => {
      // Opponent mates in 1: -10000 - (-1 * 100) = -9900
      expect(mateToCentipawns(-1)).toBe(-9900);

      // Opponent mates in 2: -10000 - (-2 * 100) = -9800
      expect(mateToCentipawns(-2)).toBe(-9800);

      // Opponent mates in 3: -10000 - (-3 * 100) = -9700
      expect(mateToCentipawns(-3)).toBe(-9700);

      // Surviving longer is better than getting mated immediately
      expect(mateToCentipawns(-3)).toBeGreaterThan(mateToCentipawns(-1));
    });

    it("returns 0 for stalemate / mate 0", () => {
      expect(mateToCentipawns(0)).toBe(0);
    });

    it("evalToCentipawns correctly delegates between cp and mate", () => {
      expect(evalToCentipawns("cp", 150)).toBe(150);
      expect(evalToCentipawns("cp", -80)).toBe(-80);
      expect(evalToCentipawns("mate", 2)).toBe(9800);
      expect(evalToCentipawns("mate", -2)).toBe(-9800);
    });
  });

  // ==========================================================================
  // §11.2 — Formal Polarity Inversion
  // ==========================================================================
  describe("§11.2 Polarity Inversion", () => {
    it("inverts centipawn evaluation from opponent's perspective to mover's perspective", () => {
      // If Stockfish sees fen_after as +50 for the opponent, it is -50 for the mover
      const inverted = invertEvaluation({ type: "cp", value: 50 });
      expect(inverted.centipawns).toBe(-50);
      expect(inverted.type).toBe("cp");

      // If Stockfish sees fen_after as -120 for opponent, it is +120 for mover
      const invertedAdvantage = invertEvaluation({ type: "cp", value: -120 });
      expect(invertedAdvantage.centipawns).toBe(120);
    });

    it("inverts mate evaluation correctly using continuous mate mapping", () => {
      // If Stockfish says mate +2 for opponent (mover will be mated in 2)
      // Opponent perspective: +9800 -> Mover perspective: -9800
      const opponentMates = invertEvaluation({ type: "mate", value: 2 });
      expect(opponentMates.centipawns).toBe(-9800);

      // If Stockfish says mate -1 for opponent (mover delivers mate in 1)
      // Opponent perspective: -9900 -> Mover perspective: +9900
      const moverMates = invertEvaluation({ type: "mate", value: -1 });
      expect(moverMates.centipawns).toBe(9900);
    });
  });

  // ==========================================================================
  // §11.2 — Centipawn Loss Math
  // ==========================================================================
  describe("§11.2 Centipawn Loss (CPL) Computation", () => {
    it("computes CPL_raw as max(0, Eval_best - Eval_played)", () => {
      const { cplRaw, cplCapped } = computeCentipawnLoss(150, 50);
      expect(cplRaw).toBe(100);
      expect(cplCapped).toBe(100);
    });

    it("ensures CPL is never negative even if played move exceeds best move eval", () => {
      const { cplRaw, cplCapped } = computeCentipawnLoss(100, 150);
      expect(cplRaw).toBe(0);
      expect(cplCapped).toBe(0);
    });

    it("caps CPL at 1000 per §11.2 specification", () => {
      // Huge blunder throwing away a massive advantage
      const { cplRaw, cplCapped } = computeCentipawnLoss(2500, -500);
      expect(cplRaw).toBe(3000);
      expect(cplCapped).toBe(1000);
    });

    it("correctly handles the §11.3 forced mate transition example (+M2 to 0.00)", () => {
      // Best move: +M2 = +9800
      // Played move: 0.00
      // CPL_raw = 9800 - 0 = 9800, CPL_capped = 1000
      const evalBest = mateToCentipawns(2); // 9800
      const evalPlayed = 0;
      const { cplRaw, cplCapped } = computeCentipawnLoss(evalBest, evalPlayed);
      expect(cplRaw).toBe(9800);
      expect(cplCapped).toBe(1000);
    });
  });

  // ==========================================================================
  // §11.4 — Logistic Win Probability
  // ==========================================================================
  describe("§11.4 Logistic Win Probability Sigmoid W(cp)", () => {
    it("returns 0.5 for equal position (0 cp)", () => {
      expect(winProbability(0)).toBe(0.5);
    });

    it("computes standard sigmoid values at ±400 centipawns", () => {
      // W(400) = 1 / (1 + 10^(-1)) = 1 / 1.1 ≈ 0.9091
      expect(winProbability(400)).toBeCloseTo(0.9091, 3);

      // W(-400) = 1 / (1 + 10^(1)) = 1 / 11 ≈ 0.0909
      expect(winProbability(-400)).toBeCloseTo(0.0909, 3);
    });

    it("saturates near 1.0 and 0.0 for extreme evaluations", () => {
      expect(winProbability(5000)).toBeGreaterThan(0.999);
      expect(winProbability(-5000)).toBeLessThan(0.001);
    });

    it("is strictly monotonic with respect to centipawns", () => {
      const evals = [-800, -400, -100, 0, 100, 400, 800];
      for (let i = 0; i < evals.length - 1; i++) {
        expect(winProbability(evals[i])).toBeLessThan(winProbability(evals[i + 1]));
      }
    });
  });

  // ==========================================================================
  // §11.4 — Six-Tier Mistake Classification
  // ==========================================================================
  describe("§11.4 Mistake Classification Tiers", () => {
    it("classifies BEST move when CPL <= 10 or ΔW < 0.02", () => {
      const res = classifyMove(100, 95);
      expect(res.mistakeType).toBe("BEST");
      expect(res.cplCapped).toBe(5);
      expect(res.winProbDelta).toBeLessThan(0.02);
    });

    it("classifies GOOD move when 10 < CPL <= 30", () => {
      const res = classifyMove(100, 75);
      expect(res.mistakeType).toBe("GOOD");
      expect(res.cplCapped).toBe(25);
    });

    it("classifies INACCURACY when 30 < CPL <= 90", () => {
      const res = classifyMove(100, 40);
      expect(res.mistakeType).toBe("INACCURACY");
      expect(res.cplCapped).toBe(60);
    });

    it("classifies MISTAKE when 90 < CPL <= 200", () => {
      const res = classifyMove(100, -50);
      expect(res.mistakeType).toBe("MISTAKE");
      expect(res.cplCapped).toBe(150);
    });

    it("classifies BLUNDER when CPL > 200 or ΔW >= 0.25", () => {
      const res = classifyMove(100, -300);
      expect(res.mistakeType).toBe("BLUNDER");
      expect(res.cplCapped).toBe(400);
      expect(res.winProbDelta).toBeGreaterThanOrEqual(0.25);
    });

    it("classifies MISSED_WIN when W_before > 0.80 drops to W_after < 0.55", () => {
      // evalBest = +350 (W ≈ 0.88), played = 0 (W = 0.50)
      const res = classifyMove(350, 0);
      expect(res.mistakeType).toBe("MISSED_WIN");
      expect(res.winProbBefore).toBeGreaterThan(0.8);
      expect(res.winProbAfter).toBeLessThan(0.55);
    });

    it("detects MISSED_WIN using explicit prevEvalCp", () => {
      // Position before was winning (+400, W ≈ 0.91), played move resulted in equal (0 cp)
      const res = classifyMove(200, 0, 400);
      expect(res.mistakeType).toBe("MISSED_WIN");
      expect(res.winProbBefore).toBeGreaterThan(0.8);
      expect(res.winProbAfter).toBeLessThan(0.55);
    });
  });

  // ==========================================================================
  // §11.5 — Opening Book ACPL Exclusion
  // ==========================================================================
  describe("§11.5 Opening Book ACPL Calculation", () => {
    it("excludes book moves from average centipawn loss computation", () => {
      const moves = [
        { cplCapped: 5, isBookMove: true },   // e4 (book)
        { cplCapped: 10, isBookMove: true },  // Nf3 (book)
        { cplCapped: 50, isBookMove: false }, // d4 (non-book)
        { cplCapped: 150, isBookMove: false },// blunder (non-book)
      ];

      // Average of non-book moves: (50 + 150) / 2 = 100
      expect(computeACPL(moves)).toBe(100);
    });

    it("returns 0 if all moves are book moves", () => {
      const moves = [
        { cplCapped: 5, isBookMove: true },
        { cplCapped: 10, isBookMove: true },
      ];
      expect(computeACPL(moves)).toBe(0);
    });

    it("returns 0 for empty moves array", () => {
      expect(computeACPL([])).toBe(0);
    });
  });
});
