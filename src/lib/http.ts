import { NextResponse } from "next/server";
import { ZodLikeError } from "@/lib/validate";

/** Centralised, typed HTTP error. Throw it anywhere inside an API handler. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m, "bad_request");
export const unauthorized = (m = "Sign in required") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "You do not have access to this resource") => new HttpError(403, m, "forbidden");
export const notFound = (m = "Not found") => new HttpError(404, m, "not_found");

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps route handlers so every failure becomes a consistent JSON error. */
export function withErrors<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof ZodLikeError) {
        return NextResponse.json({ error: err.message, code: "validation" }, { status: 422 });
      }
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      const dbHint = /duplicate key|unique/i.test(String((err as Error)?.message))
        ? "That already exists."
        : "Something went wrong. Please try again.";
      return NextResponse.json({ error: dbHint, code: "internal" }, { status: 500 });
    }
  };
}

export const ok = (data: unknown = { ok: true }, init?: ResponseInit) => NextResponse.json(data, init);

/** Reads JSON bodies safely (returns {} for empty bodies). */
export async function readJson<T extends Record<string, unknown> = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw badRequest("Malformed JSON body");
  }
}
