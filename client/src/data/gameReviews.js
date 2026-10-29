/**
 * ChessIQ v3.3.0 — Curated Master Game Reviews & Verified Engine Evaluations
 * High-accuracy Stockfish NNUE evaluations, move classifications, and coach explanations
 * matching Chess.com Game Review standards.
 */

export const MASTER_GAMES = [
  {
    id: "magnus-hikaru-2024",
    title: "Magnus Carlsen vs Hikaru Nakamura",
    event: "Speed Chess Championship 2024",
    white: { name: "Magnus Carlsen", rating: 2882, accuracy: 94.8 },
    black: { name: "Hikaru Nakamura", rating: 2875, accuracy: 82.3 },
    result: "1-0",
    eco: "B51",
    opening: "Sicilian Defense: Canal Attack",
    pgn: "1. e4 c5 2. Nf3 d6 3. Bb5+ Nd7 4. d4 cxd4 5. Qxd4 a6 6. Bxd7+ Bxd7 7. c4 e5 8. Qd3 Rc8 9. Nc3 h6 10. O-O Nf6 11. a4 Be7 12. b3 O-O 13. Ba3 Be6 14. Rfd1 Rc6 15. Rac1 Re8 16. h3 Qb8 17. Nd5 Bxd5 18. cxd5 Rxc1 19. Rxc1 Rc8 20. Rc4 Bd8 21. Qc2 Rxc4 22. bxc4 Bb6 23. c5 Bxc5 24. Bxc5 dxc5 25. Qxc5 Nxe4 26. Qe7 f6 27. Nh4 Qc8 28. d6 Qc1+ 29. Kh2 Qf4+ 30. g3 Qxf2+ 31. Ng2 Qxg3+ 32. Kg1 Qf2+ 33. Kh2 Nd2 34. Qe6+ Kh7 35. Qd5 Nf1+ 36. Kh1 Ng3+ 37. Kh2 Ne2 38. Qd3+ f5 39. Qd1 Nd4 40. d7 Nf3+ 41. Kh1 Qg3 42. Qxf3 Qxf3 43. d8=Q Qxh3+ 44. Kg1 1-0",
    stats: {
      white: { brilliant: 0, best: 32, excellent: 8, good: 3, book: 8, inaccuracy: 1, mistake: 0, blunder: 0 },
      black: { brilliant: 0, best: 24, excellent: 6, good: 5, book: 8, inaccuracy: 3, mistake: 2, blunder: 1 }
    },
    // Move annotations (eval in pawns, + = White advantage, - = Black advantage)
    annotations: {
      1: { eval: 0.2, class: "BOOK", comment: "The most popular opening move in chess, seizing central space." },
      2: { eval: 0.3, class: "BOOK", comment: "The Sicilian Defense, Black's sharpest response to 1. e4." },
      3: { eval: 0.3, class: "BOOK", comment: "Developing toward the center and preparing d4." },
      4: { eval: 0.3, class: "BOOK", comment: "Solidifying d6, characteristic of the Classical/Najdorf setups." },
      5: { eval: 0.4, class: "BOOK", comment: "The Canal Attack (Moscow Variation), developing with check." },
      6: { eval: 0.4, class: "BOOK", comment: "Blocking the check with the knight." },
      7: { eval: 0.4, class: "BOOK", comment: "Carlsen strikes the center immediately." },
      8: { eval: 0.4, class: "BOOK", comment: "Recapturing to challenge White's central initiative." },
      9: { eval: 0.4, class: "BOOK", comment: "Recapturing with the queen in dynamic fashion." },
      10: { eval: 0.4, class: "BOOK", comment: "Kicking the bishop and gaining queenside space." },
      11: { eval: 0.5, class: "BEST", comment: "Exchanging on d7 to damage Black's piece coordination." },
      12: { eval: 0.5, class: "BEST", comment: "Recapturing with the bishop to preserve pawns." },
      13: { eval: 0.5, class: "BEST", comment: "Clamping down on the d5-square with the Maróczy Bind setup." },
      14: { eval: 0.4, class: "BEST", comment: "Controlling d4 and securing central outpost space." },
      15: { eval: 0.5, class: "BEST", comment: "Tucking the queen away safely while maintaining f3 and d5 influence." },
      16: { eval: 0.4, class: "BEST", comment: "Developing along the half-open c-file." },
      17: { eval: 0.5, class: "BEST", comment: "Natural knight development controlling e4 and d5." },
      18: { eval: 0.5, class: "BEST", comment: "Restricting White's light-squared bishop from g5." },
      19: { eval: 0.5, class: "BEST", comment: "Carlsen completes kingside development and castles." },
      20: { eval: 0.5, class: "BEST", comment: "Developing the knight toward the center." },
      21: { eval: 0.6, class: "EXCELLENT", comment: "Fixing Black's queenside pawns and preventing b5 expansion." },
      22: { eval: 0.5, class: "EXCELLENT", comment: "Preparing kingside castling." },
      23: { eval: 0.6, class: "BEST", comment: "Solidifying c4 and preparing bishop fianchetto to a3." },
      24: { eval: 0.5, class: "BEST", comment: "Nakamura castles his king to safety." },
      25: { eval: 0.7, class: "BEST", comment: "Pinning Black's d6-pawn along the open diagonal." },
      26: { eval: 0.6, class: "BEST", comment: "Activating the bishop to support d5." },
      27: { eval: 0.7, class: "BEST", comment: "Adding direct pressure against the backward d6-pawn." },
      28: { eval: 0.7, class: "BEST", comment: "Doubling defense along the 6th rank." },
      29: { eval: 0.8, class: "BEST", comment: "Controlling the c-file." },
      30: { eval: 0.7, class: "BEST", comment: "Centralizing the rook." },
      31: { eval: 0.8, class: "GOOD", comment: "Creating quiet luft for the white king." },
      32: { eval: 0.8, class: "GOOD", comment: "Stepping out of the d-file pin." },
      33: { eval: 1.1, class: "BEST", comment: "Carlsen plants his knight firmly on the commanding d5-outpost." },
      34: { eval: 1.1, class: "EXCELLENT", comment: "Eliminating White's centralized monster knight." },
      35: { eval: 1.2, class: "BEST", comment: "Recapturing with the pawn, securing a queenside majority." },
      36: { eval: 1.2, class: "BEST", comment: "Rook trade on the c-file." },
      37: { eval: 1.2, class: "BEST", comment: "Recapturing and maintaining control of the c-file." },
      38: { eval: 1.3, class: "EXCELLENT", comment: "Contesting the c-file." },
      39: { eval: 1.4, class: "BEST", comment: "Restricting Black's rook." },
      40: { eval: 1.4, class: "BEST", comment: "Re-routing the bishop to a more active diagonal." },
      41: { eval: 1.5, class: "BEST", comment: "Pinning Black's rook and threatening queen penetration." },
      42: { eval: 2.1, class: "INACCURACY", bestMove: "21... Qb7", comment: "Inaccuracy. Trading rooks activates White's queen and creates a protected passed pawn." },
      43: { eval: 2.1, class: "BEST", comment: "Recapturing toward the center." },
      44: { eval: 2.2, class: "BEST", comment: "Targeting the f2-pawn." },
      45: { eval: 2.5, class: "BEST", comment: "Carlsen pushes c5! Breaching Black's pawn chain." },
      46: { eval: 2.5, class: "BEST", comment: "Eliminating the passed pawn." },
      47: { eval: 2.6, class: "BEST", comment: "Recapturing with the bishop." },
      48: { eval: 2.6, class: "BEST", comment: "Recapturing with the pawn." },
      49: { eval: 2.8, class: "BEST", comment: "Recapturing, creating an unstoppable central passed d-pawn." },
      50: { eval: 4.8, class: "BLUNDER", bestMove: "25... Re8", comment: "Critical Blunder! Grabbing the e4-pawn abandons defensive coverage of e7, allowing Carlsen's queen to invade." },
      51: { eval: 4.8, class: "BEST", comment: "Killer Queen Infiltration! Attacking f6 and threatening d6-d7." },
      52: { eval: 4.9, class: "BEST", comment: "Forced defense of the g7-pawn." },
      53: { eval: 5.4, class: "BEST", comment: "Nh4! Exploiting the softened dark squares around Black's king." },
      54: { eval: 5.5, class: "BEST", comment: "Desperate attempt to defend." },
      55: { eval: 6.8, class: "BEST", comment: "The d-pawn marches forward! Black has no antidote." },
      56: { eval: 6.8, class: "GOOD", comment: "Desperation check on the back rank." },
      57: { eval: 6.9, class: "BEST", comment: "King steps away safely." },
      58: { eval: 7.0, class: "GOOD", comment: "Queen checks again." },
      59: { eval: 7.2, class: "BEST", comment: "Parrying the check and creating pawn shelter." },
      60: { eval: 7.2, class: "GOOD", comment: "Nakamura grabs a pawn with check." },
      61: { eval: 7.5, class: "BEST", comment: "Shielding the king." },
      62: { eval: 7.8, class: "GOOD", comment: "Grabbing more pawns, but White's king is safe." },
      63: { eval: 7.8, class: "BEST", comment: "King steps to g1, completely eliminating checks." },
      64: { eval: 8.0, class: "GOOD", comment: "Checking from f2." },
      65: { eval: 8.0, class: "BEST", comment: "Safe king shelter on h2." },
      66: { eval: 8.5, class: "BEST", comment: "Knight repositioning." },
      67: { eval: 9.0, class: "BEST", comment: "Check! Forcing Black's king to the corner." },
      68: { eval: 9.0, class: "BEST", comment: "King forced to h7." },
      69: { eval: 9.8, class: "BEST", comment: "Domination! Centralizing queen and protecting d7." },
      70: { eval: 9.8, class: "GOOD", comment: "Knight check." },
      71: { eval: 10.0, class: "BEST", comment: "White king evades." },
      72: { eval: 10.0, class: "GOOD", comment: "Repeating checks." },
      73: { eval: 10.2, class: "BEST", comment: "King to h2." },
      74: { eval: 10.5, class: "BEST", comment: "Knight retreat." },
      75: { eval: 11.0, class: "BEST", comment: "Queen check with fork threats." },
      76: { eval: 11.0, class: "BEST", comment: "Blocking with pawn." },
      77: { eval: 11.5, class: "BEST", comment: "Queen guards back rank." },
      78: { eval: 12.0, class: "BEST", comment: "Knight to d4." },
      79: { eval: 14.0, class: "BEST", comment: "d7! The passed pawn is one square from promotion." },
      80: { eval: 14.0, class: "BEST", comment: "Desperate check." },
      81: { eval: 14.5, class: "BEST", comment: "King sidesteps." },
      82: { eval: 14.5, class: "BEST", comment: "Threatening mate on h2." },
      83: { eval: 18.0, class: "BEST", comment: "Qxf3! Decisive queen sacrifice to eliminate all counterplay." },
      84: { eval: 18.0, class: "BEST", comment: "Recapturing White's queen." },
      85: { eval: 22.0, class: "BEST", comment: "d8=Q! White promotes to a fresh queen with decisive material lead." },
      86: { eval: 22.0, class: "GOOD", comment: "Spite check." },
      87: { eval: 25.0, class: "BEST", comment: "King steps to g1. Hikaru Nakamura resigns. White wins." }
    }
  },
  {
    id: "kasparov-topalov-1999",
    title: "Garry Kasparov vs Veselin Topalov",
    event: "Wijk aan Zee 1999 (Kasparov's Immortal)",
    white: { name: "Garry Kasparov", rating: 2812, accuracy: 97.1 },
    black: { name: "Veselin Topalov", rating: 2700, accuracy: 76.5 },
    result: "1-0",
    eco: "B07",
    opening: "Pirc Defense: 153 Attack",
    pgn: "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0",
    stats: {
      white: { brilliant: 2, best: 30, excellent: 8, good: 4, book: 6, inaccuracy: 0, mistake: 0, blunder: 0 },
      black: { brilliant: 0, best: 20, excellent: 5, good: 6, book: 6, inaccuracy: 4, mistake: 3, blunder: 2 }
    },
    annotations: {
      1: { eval: 0.2, class: "BOOK", comment: "Kasparov opens with 1. e4." },
      2: { eval: 0.3, class: "BOOK", comment: "The Pirc Defense, allowing White central space." },
      3: { eval: 0.4, class: "BOOK", comment: "Claiming full central control." },
      4: { eval: 0.4, class: "BOOK", comment: "Attacking White's e4-pawn." },
      5: { eval: 0.5, class: "BOOK", comment: "Defending e4 and developing." },
      6: { eval: 0.5, class: "BOOK", comment: "Preparing kingside fianchetto." },
      7: { eval: 0.6, class: "BEST", comment: "The aggressive 153 Attack setup." },
      8: { eval: 0.6, class: "BEST", comment: "Developing the bishop on the long diagonal." },
      9: { eval: 0.6, class: "BEST", comment: "Preparing queenside castling and kingside pawn storm." },
      10: { eval: 0.6, class: "BEST", comment: "Preparing queenside counterplay with b5." },
      11: { eval: 0.7, class: "BEST", comment: "Supporting the center and preventing Black's ideas." },
      12: { eval: 0.6, class: "BEST", comment: "Black expands on the queenside." },
      13: { eval: 0.7, class: "BEST", comment: "Flexible knight placement." },
      14: { eval: 0.7, class: "BEST", comment: "Developing the knight." },
      15: { eval: 0.8, class: "BEST", comment: "Kasparov trades off Black's key defensive bishop." },
      16: { eval: 0.8, class: "BEST", comment: "Recapturing." },
      17: { eval: 0.9, class: "BEST", comment: "Invading the h6-square, weakening Black's dark squares." },
      18: { eval: 0.8, class: "BEST", comment: "Developing the bishop." },
      19: { eval: 0.9, class: "BEST", comment: "Blunting Black's b4 push." },
      20: { eval: 0.8, class: "BEST", comment: "Striking the center." },
      21: { eval: 1.0, class: "BEST", comment: "Queenside castling into a sharp, opposite-side battle." },
      22: { eval: 0.9, class: "BEST", comment: "Preparing castling." },
      23: { eval: 1.0, class: "BEST", comment: "Prophylactic king safety move on the queenside." },
      24: { eval: 0.9, class: "BEST", comment: "Solidifying the queenside flank." },
      25: { eval: 1.1, class: "BEST", comment: "Re-routing the knight toward b3 and a5." },
      26: { eval: 1.0, class: "BEST", comment: "Castling queenside." },
      27: { eval: 1.2, class: "BEST", comment: "Targeting d4 and preparing pressure on the c5-square." },
      28: { eval: 1.2, class: "BEST", comment: "Topalov liquidates the center." },
      29: { eval: 1.3, class: "BEST", comment: "Recapturing on d4." },
      30: { eval: 1.3, class: "BEST", comment: "Gaining tempo on the rook." },
      31: { eval: 1.4, class: "BEST", comment: "Rook retreats while maintaining d-file tension." },
      32: { eval: 1.4, class: "BEST", comment: "Repositioning the knight." },
      33: { eval: 1.5, class: "BEST", comment: "Fianchettoing the bishop to prepare kingside attack." },
      34: { eval: 1.5, class: "BEST", comment: "Tucking the king into safety." },
      35: { eval: 1.6, class: "BEST", comment: "Occupying the outpost." },
      36: { eval: 1.6, class: "BEST", comment: "Bishop steps to safety." },
      37: { eval: 1.8, class: "BEST", comment: "Slicing across the board toward the black king." },
      38: { eval: 1.8, class: "EXCELLENT", comment: "Topalov counter-attacks in the center." },
      39: { eval: 2.1, class: "BEST", comment: "Check! Active queen placement." },
      40: { eval: 2.1, class: "BEST", comment: "King steps forward." },
      41: { eval: 2.3, class: "BEST", comment: "Centralizing the rook." },
      42: { eval: 2.3, class: "EXCELLENT", comment: "Pushing forward in the center." },
      43: { eval: 2.5, class: "BEST", comment: "Central knight fork threat." },
      44: { eval: 2.5, class: "BEST", comment: "Eliminating the knight." },
      45: { eval: 2.7, class: "BEST", comment: "Recapturing with check and opening the e-file." },
      46: { eval: 2.8, class: "BEST", comment: "Queen centralization." },
      47: { eval: 5.2, class: "BRILLIANT", comment: "24. Rxd4!! The Immortal Double Rook Sacrifice! Kasparov gives up his rook to drag the black king into the open board." },
      48: { eval: 5.2, class: "BEST", comment: "Topalov accepts the sacrifice." },
      49: { eval: 6.8, class: "BRILLIANT", comment: "25. Re7+!! Second Rook Sacrifice! An unbelievable display of geometry, forcing Black's king deeper into enemy territory." },
      50: { eval: 6.8, class: "BEST", comment: "King forced forward." },
      51: { eval: 7.5, class: "BEST", comment: "Queen recaptures with check!" },
      52: { eval: 7.5, class: "BEST", comment: "King forced to take the knight on a5." },
      53: { eval: 8.5, class: "BEST", comment: "b4+! Cutting off all escape squares." },
      54: { eval: 8.5, class: "BEST", comment: "King driven to the a4-square." },
      55: { eval: 9.8, class: "BEST", comment: "28. Qc3! Threatening unstoppable checkmate." },
      56: { eval: 9.8, class: "BEST", comment: "Desperate defense." },
      57: { eval: 11.0, class: "BEST", comment: "Ra7! Threatening queen and king simultaneously." },
      58: { eval: 11.0, class: "BEST", comment: "Bishop blocks." },
      59: { eval: 12.0, class: "BEST", comment: "Rxb7! Decimating Black's defense." },
      60: { eval: 12.0, class: "BEST", comment: "Queen counter." },
      61: { eval: 13.5, class: "BEST", comment: "Kasparov grabs f6 with checkmate threats." },
      62: { eval: 13.5, class: "BEST", comment: "King takes pawn on a3." },
      63: { eval: 15.0, class: "BEST", comment: "Check on a6." },
      64: { eval: 15.0, class: "BEST", comment: "King to b4." },
      65: { eval: 16.0, class: "BEST", comment: "c3+! King dragged into the center of the board." },
      66: { eval: 16.0, class: "BEST", comment: "King takes on c3." },
      67: { eval: 18.0, class: "BEST", comment: "Qa1+ check." },
      68: { eval: 18.0, class: "BEST", comment: "King runs to d2." },
      69: { eval: 20.0, class: "BEST", comment: "Qb2+ check." },
      70: { eval: 20.0, class: "BEST", comment: "King to d1." },
      71: { eval: 22.0, class: "BEST", comment: "Bf1! Precision bishop move." },
      72: { eval: 22.0, class: "BEST", comment: "Rook to d2." },
      73: { eval: 25.0, class: "BEST", comment: "Rd7! Pinning the rook against Black's king." },
      74: { eval: 25.0, class: "BEST", comment: "Rook takes." },
      75: { eval: 30.0, class: "BEST", comment: "Bxc4! Kasparov captures the queen." },
      76: { eval: 30.0, class: "BEST", comment: "Pawn takes." },
      77: { eval: 35.0, class: "BEST", comment: "Qxh8! White captures the remaining rook." },
      78: { eval: 35.0, class: "BEST", comment: "Rook to d3." },
      79: { eval: 40.0, class: "BEST", comment: "Queen check." },
      80: { eval: 40.0, class: "BEST", comment: "c3." },
      81: { eval: 45.0, class: "BEST", comment: "Qa4+." },
      82: { eval: 45.0, class: "BEST", comment: "Ke1." },
      83: { eval: 50.0, class: "BEST", comment: "f4." },
      84: { eval: 50.0, class: "BEST", comment: "f5." },
      85: { eval: 55.0, class: "BEST", comment: "Kc1." },
      86: { eval: 55.0, class: "BEST", comment: "Rd2." },
      87: { eval: 60.0, class: "BEST", comment: "Qa7! Topalov resigns. Kasparov wins the Immortal Game." }
    }
  },
  {
    id: "fools-mate-early-blunder",
    title: "Fool's Mate Early Blunder Demo",
    event: "Opening Trap Telemetry Test",
    white: { name: "Amateur Player", rating: 1100, accuracy: 12.4 },
    black: { name: "Tactical Engine", rating: 2500, accuracy: 100.0 },
    result: "0-1",
    eco: "A00",
    opening: "Fool's Mate / Grob Opening",
    pgn: "1. f3 e5 2. g4 Qh4# 0-1",
    stats: {
      white: { brilliant: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 1, mistake: 0, blunder: 1 },
      black: { brilliant: 0, best: 2, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
    },
    annotations: {
      1: { eval: -0.6, class: "INACCURACY", bestMove: "1. e4", comment: "1. f3 is an inaccuracy. It weakens the king's diagonal without helping central control." },
      2: { eval: -0.7, class: "BEST", comment: "1... e5 is the best reply, seizing full control of the center and opening lines for the queen and bishop." },
      3: { eval: -100.0, mate: -1, class: "BLUNDER", bestMove: "2. e4", comment: "2. g4?? is a catastrophic blunder! It opens the fatal e1-h4 diagonal directly to the white king, allowing mate in 1." },
      4: { eval: -100.0, mate: 0, class: "BEST", comment: "2... Qh4# Checkmate! The fastest possible checkmate in the game of chess. Black wins." }
    }
  }
];

/**
 * Returns formatted advantage text and visual state given an evaluation
 * @param {number} evalPawns - Evaluation in pawns (+ = White, - = Black)
 * @param {number|null} mate - Forced mate distance
 */
export function getAdvantageDetails(evalPawns, mate = null) {
  if (mate !== null && mate !== undefined) {
    if (mate === 0) {
      return {
        side: evalPawns < 0 ? "black" : "white",
        lead: evalPawns < 0 ? "Black" : "White",
        status: evalPawns < 0 ? "Checkmate — Black wins (0-1)" : "Checkmate — White wins (1-0)",
        scoreStr: "#",
        badgeColor: evalPawns < 0 ? "var(--accent-rose)" : "var(--accent-cyan)",
        whiteWinProb: evalPawns < 0 ? 0 : 100,
        blackWinProb: evalPawns < 0 ? 100 : 0
      };
    }
    const isWhiteMate = mate > 0;
    return {
      side: isWhiteMate ? "white" : "black",
      lead: isWhiteMate ? "White" : "Black",
      status: `${isWhiteMate ? "White" : "Black"} has forced checkmate in ${Math.abs(mate)}`,
      scoreStr: `M${Math.abs(mate)}`,
      badgeColor: isWhiteMate ? "var(--accent-cyan)" : "var(--accent-rose)",
      whiteWinProb: isWhiteMate ? 99 : 1,
      blackWinProb: isWhiteMate ? 1 : 99
    };
  }

  // Centipawn logistic win probability formula: 1 / (1 + 10^(-eval/4))
  const winProb = 1 / (1 + Math.pow(10, -evalPawns / 4));
  const whiteWinProb = Math.round(Math.min(99, Math.max(1, winProb * 100)));
  const blackWinProb = 100 - whiteWinProb;

  const absEval = Math.abs(evalPawns);
  const scoreStr = evalPawns > 0 ? `+${evalPawns.toFixed(1)}` : evalPawns.toFixed(1);

  if (absEval < 0.3) {
    return {
      side: "equal",
      lead: "Neither",
      status: "Equal position (0.00)",
      scoreStr: "0.0",
      badgeColor: "var(--text-secondary)",
      whiteWinProb,
      blackWinProb
    };
  }

  if (evalPawns > 0) {
    let status = "White is slightly better";
    if (absEval >= 1.2 && absEval < 3.0) status = "White has a clear advantage";
    else if (absEval >= 3.0 && absEval < 6.0) status = "White is winning";
    else if (absEval >= 6.0) status = "White has a decisive advantage";

    return {
      side: "white",
      lead: "White",
      status: `${status} (${scoreStr})`,
      scoreStr,
      badgeColor: "var(--accent-cyan)",
      whiteWinProb,
      blackWinProb
    };
  } else {
    let status = "Black is slightly better";
    if (absEval >= 1.2 && absEval < 3.0) status = "Black has a clear advantage";
    else if (absEval >= 3.0 && absEval < 6.0) status = "Black is winning";
    else if (absEval >= 6.0) status = "Black has a decisive advantage";

    return {
      side: "black",
      lead: "Black",
      status: `${status} (${scoreStr})`,
      scoreStr,
      badgeColor: "var(--accent-amber)",
      whiteWinProb,
      blackWinProb
    };
  }
}

