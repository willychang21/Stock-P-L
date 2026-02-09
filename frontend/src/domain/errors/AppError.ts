export class AppError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, details?: Record<string, any>, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export type Result<T, E = AppError> = { success: true; value: T } | { success: false; error: E };

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ success: true, value }),
  fail: <E>(error: E): Result<never, E> => ({ success: false, error }),
};
