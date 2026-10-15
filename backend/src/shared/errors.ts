/** An expected failure that maps to a clean JSON error response. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this action.') => new AppError(403, 'forbidden', message);
export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
/** Well-formed but impossible values (a 900 kg set). */
export const unprocessable = (code: string, message: string) => new AppError(422, code, message);

/** Postgres unique_violation, e.g. from a race on a unique index. */
export const isUniqueViolation = (e: unknown): boolean => pgCode(e) === '23505';

function pgCode(e: unknown): string | undefined {
  // Drizzle wraps driver errors; the Postgres code sits on the error or its cause.
  let cur: unknown = e;
  for (let i = 0; i < 3 && cur && typeof cur === 'object'; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}
