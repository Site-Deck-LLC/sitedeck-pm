"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.mapServiceErrorToApiError = mapServiceErrorToApiError;
exports.errorHandlerMiddleware = errorHandlerMiddleware;
class ApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
function mapServiceErrorToApiError(err) {
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
function errorHandlerMiddleware(err, _req, res, _next) {
    const apiError = mapServiceErrorToApiError(err);
    res.status(apiError.statusCode).json({
        error: {
            code: apiError.code,
            message: apiError.message,
        },
    });
}
//# sourceMappingURL=error-handler.js.map