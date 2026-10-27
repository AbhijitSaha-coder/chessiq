/**
 * ChessIQ v3.3.0 — Standardized Operational Error Class
 * Implements canonical error codes defined in the ChessIQ v3.3.0 Specification.
 */

class AppError extends Error {
  /**
   * @param {string} code - Canonical error identifier (e.g., 'AMBIGUOUS_PLAYER_IDENTITY')
   * @param {string} message - Human-readable diagnostic description
   * @param {number} statusCode - HTTP response code (e.g., 400, 409, 422, 500)
   * @param {Record<string, any>} [details] - Optional contextual metadata (e.g., existing_game_id)
   */
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details && Object.keys(this.details).length > 0 ? this.details : {}),
    };
  }

  // Canonical Factory Helpers defined in Specification

  static ambiguousPlayerIdentity(message = "Authenticated user does not match PGN White or Black headers. Please specify user_color ('WHITE' | 'BLACK') or account_handle.") {
    return new AppError('AMBIGUOUS_PLAYER_IDENTITY', message, 422);
  }

  static duplicateGame(existingGameId, message = 'This exact game has already been uploaded and analyzed for this account.') {
    return new AppError('DUPLICATE_GAME', message, 409, {
      existing_game_id: existingGameId,
    });
  }

  static staleLeaseEviction(message = 'Job lock lease expired or was revoked by recovery sweep. Fencing token invalidated.') {
    return new AppError('STALE_LEASE_EVICTION', message, 409);
  }

  static circuitBreakerTripped(message = 'Circuit breaker tripped due to consecutive failure threshold.') {
    return new AppError('CIRCUIT_BREAKER_TRIPPED', message, 503);
  }

  static validationError(message, details = {}) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }

  static unauthorized(message = 'Authentication required. No valid session cookie found.') {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message = 'Access denied. You do not possess the required permissions.') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message = 'The requested resource does not exist.') {
    return new AppError('NOT_FOUND', message, 404);
  }

  static internal(message = 'An unexpected internal server error occurred.') {
    return new AppError('INTERNAL_SERVER_ERROR', message, 500);
  }
}

module.exports = AppError;
