// Express 4 does not catch rejected promises from async route handlers.
// Without this wrapper, one bad request (for example a malformed ObjectId) can
// crash the whole API process on modern Node versions.
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
