import { badRequest } from "@/lib/http";

/** Lightweight validation error used by withErrors (422). */
export class ZodLikeError extends Error {}

export function str(v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) {
    if (opts.optional) return "";
    throw badRequest(`${field} is required`);
  }
  if (opts.min !== undefined && s.length < opts.min) throw badRequest(`${field} must be at least ${opts.min} characters`);
  if (opts.max !== undefined && s.length > opts.max) throw badRequest(`${field} must be at most ${opts.max} characters`);
  return s;
}

export function uuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw badRequest(`${field} must be a valid id`);
  }
  return v;
}

export function int(v: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} must be an integer between ${min} and ${max}`);
  return n;
}

export function oneOf<T extends string>(v: unknown, values: readonly T[], field: string): T {
  if (typeof v !== "string" || !values.includes(v as T)) throw badRequest(`${field} must be one of: ${values.join(", ")}`);
  return v as T;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
