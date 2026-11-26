import { ZodError } from 'zod';
import crypto from 'crypto';

export class DomainError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHORIZED' | 'CONFLICT' | 'VALIDATION' | 'RATE_LIMITED',
    message: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(msg = 'Resource not found') {
    super('NOT_FOUND', msg);
  }
}

export class ForbiddenError extends DomainError {
  constructor(msg = 'You do not have permission to perform this action') {
    super('FORBIDDEN', msg);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(msg = 'Authentication required') {
    super('UNAUTHORIZED', msg);
  }
}

export class ConflictError extends DomainError {
  constructor(msg = 'State conflict — please refresh and try again') {
    super('CONFLICT', msg);
  }
}

export class ValidationError extends DomainError {
  constructor(msg = 'Invalid input', fieldErrors?: Record<string, string[]>) {
    super('VALIDATION', msg, fieldErrors);
  }
}

export class RateLimitedError extends DomainError {
  constructor(msg = 'Too many attempts — please wait and try again') {
    super('RATE_LIMITED', msg);
  }
}

export type ActionError = {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function toActionError(err: unknown): { ok: false; error: ActionError } {
  const requestId = crypto.randomBytes(6).toString('hex');

  if (err instanceof DomainError) {
    return {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        fieldErrors: err.fieldErrors,
      },
    };
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '_form';
      fieldErrors[path] = fieldErrors[path] ?? [];
      fieldErrors[path].push(issue.message);
    }
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        message: err.issues[0]?.message || 'Please check the highlighted fields',
        requestId,
        fieldErrors,
      },
    };
  }

  console.error(`[ActionError:${requestId}]`, err);
  return {
    ok: false,
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again.',
      requestId,
    },
  };
}
