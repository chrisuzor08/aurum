import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, passwordResets, profiles, sessions } from "@/db/schema";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { badRequest, HttpError, notFound, ok, readJson, withErrors } from "@/lib/http";
import { str } from "@/lib/validate";

type Ctx = { params: Promise<{ action: string }> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export const POST = withErrors<Ctx>(async (req, { params }) => {
  const { action } = await params;
  const body = await readJson(req);
  switch (action) {
    case "register":
      return register(body);
    case "login":
      return login(body);
    case "logout":
      await destroySession();
      return ok({ ok: true });
    case "forgot":
      return forgot(req, body);
    case "reset":
      return reset(body);
    default:
      throw notFound("Unknown auth action");
  }
});

async function register(body: Record<string, unknown>) {
  const email = str(body.email, "Email", { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) throw badRequest("Enter a valid email address");
  const password = str(body.password, "Password", { min: 8, max: 128 });
  const username = str(body.username, "Username", { min: 3, max: 24 }).toLowerCase();
  if (!/^[a-z0-9_]+$/.test(username)) throw badRequest("Usernames may only use letters, numbers and underscores");

  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existing) throw new HttpError(409, "An account with this email already exists", "conflict");
  const [taken] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, username)).limit(1);
  if (taken) throw new HttpError(409, "That username is taken", "conflict");

  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [acc] = await tx.insert(accounts).values({ email, passwordHash }).returning({ id: accounts.id });
    await tx.insert(profiles).values({ id: acc!.id, username, displayName: username });
    return acc!.id;
  });
  await createSession(userId);
  return ok({ ok: true, onboardingDone: false });
}

async function login(body: Record<string, unknown>) {
  const email = str(body.email, "Email", { max: 254 }).toLowerCase();
  const password = str(body.password, "Password", { max: 128 });
  const [acc] = await db
    .select({ id: accounts.id, passwordHash: accounts.passwordHash, onboardingDone: profiles.onboardingDone })
    .from(accounts)
    .innerJoin(profiles, eq(profiles.id, accounts.id))
    .where(eq(accounts.email, email))
    .limit(1);
  // Constant-ish work even for unknown emails, and a generic message either way.
  const valid = acc ? await verifyPassword(password, acc.passwordHash) : (await hashPassword(password), false);
  if (!acc || !valid) throw new HttpError(401, "Incorrect email or password", "invalid_credentials");
  await createSession(acc.id);
  return ok({ ok: true, onboardingDone: acc.onboardingDone });
}

async function forgot(req: Request, body: Record<string, unknown>) {
  const email = str(body.email, "Email", { max: 254 }).toLowerCase();
  const [acc] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
  const message = "If an account exists for that email, a reset link is on its way.";
  if (!acc) return ok({ ok: true, message });

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    tokenHash: hash(token),
    userId: acc.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const link = `${new URL(req.url).origin}/reset-password?token=${token}`;
  // No email provider is configured in this build: the link is written to the server log.
  // Integrate an email provider here (e.g. Resend/SMTP) without changing the rest of the flow.
  console.info(`[auth] password reset link for ${email}: ${link}`);
  const devLink = process.env.NODE_ENV !== "production" ? link : undefined;
  return ok({ ok: true, message, devLink });
}

async function reset(body: Record<string, unknown>) {
  const token = str(body.token, "Reset token", { max: 200 });
  const password = str(body.password, "Password", { min: 8, max: 128 });
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hash(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, sql`now()`)))
    .limit(1);
  if (!row) throw badRequest("This reset link is invalid or has expired. Request a new one.");
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(accounts.id, row.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.tokenHash, row.tokenHash));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
  });
  return ok({ ok: true });
}
