import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, profiles, sessions } from "@/db/schema";
import type { CurrentUser } from "@/types";
import { forbidden, unauthorized } from "@/lib/http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "aurum_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a server-side session row and sets an httpOnly cookie. Only the SHA-256 of the token is stored. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Resolves the current user from the session cookie. Returns null for guests. Never trusts client-supplied ids. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      role: accounts.role,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      isPremium: profiles.isPremium,
      premiumExpiresAt: profiles.premiumExpiresAt,
      onboardingDone: profiles.onboardingDone,
    })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.id, accounts.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    role: row.role === "admin" ? "admin" : "user",
    premiumExpiresAt: row.premiumExpiresAt?.toISOString() ?? null,
  };
}

/** For Route Handlers: throws 401 when unauthenticated. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** For Route Handlers: admin-only. */
export async function requireApiAdmin(): Promise<CurrentUser> {
  const user = await requireApiUser();
  if (user.role !== "admin") throw forbidden("Administrator access required");
  return user;
}

/** For Server Components: redirects guests to login, preserving the destination. */
export async function requirePageUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For Server Components: admin pages. */
export async function requirePageAdmin(next: string): Promise<CurrentUser> {
  const user = await requirePageUser(next);
  if (user.role !== "admin") redirect("/");
  return user;
}
