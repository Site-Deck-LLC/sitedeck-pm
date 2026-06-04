import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

export function mapServiceErrorToApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const lower = message.toLowerCase();

  if (lower.includes('not found')) {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  if (lower.includes('unauthorized')) {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  if (lower.includes('forbidden') || lower.includes('permission')) {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  if (lower.includes('required') || lower.includes('invalid') || lower.includes('must be') || lower.includes('cannot')) {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  return new ApiError(500, 'INTERNAL_ERROR', message);
}

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const apiError = mapServiceErrorToApiError(err);

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  });
}
