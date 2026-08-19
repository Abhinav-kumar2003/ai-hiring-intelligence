/**
 * Authentication utilities - Clerk integration + database user synchronization.
 * Supports Clerk authentication seamlessly with Prisma SQLite user persistence.
 */
import { currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "./db";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ahp_session";
const SESSION_DURATION_DAYS = 7;

/**
 * Hash a password using scrypt (Node crypto, no external deps).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verify a password against the stored hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const testHash = scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(testHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Generate a random session token.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token for storage.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session for a user and set the cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt,
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return token;
}

/**
 * Get the current authenticated user.
 * 1. Checks Clerk authentication first.
 * 2. Synchronizes Clerk profile to Prisma User table.
 * 3. Falls back to session cookie if Clerk session is absent.
 */
export async function getCurrentUser() {
  try {
    // 1. Try Clerk authentication
    try {
      const clerkUser = await clerkCurrentUser();
      if (clerkUser) {
        const primaryEmail =
          clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress ||
          `${clerkUser.id}@clerk.user`;

        const name =
          `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
          clerkUser.username ||
          primaryEmail.split("@")[0];

        // Find or upsert user in database
        let dbUser = await db.user.findFirst({
          where: {
            OR: [{ id: clerkUser.id }, { email: primaryEmail.toLowerCase() }],
          },
        });

        if (!dbUser) {
          dbUser = await db.user.create({
            data: {
              id: clerkUser.id,
              email: primaryEmail.toLowerCase(),
              name,
              passwordHash: null,
              avatarUrl: clerkUser.imageUrl || null,
              role: "recruiter",
            },
          });
        }

        return dbUser;
      }
    } catch {
      // Clerk not initialized or development mock
    }

    // 2. Fallback to session cookie
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { token: hashToken(token) },
      include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

/**
 * Destroy the current session (logout).
 */
export async function destroySession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      await db.session.deleteMany({ where: { token: hashToken(token) } }).catch(() => {});
      store.delete(SESSION_COOKIE);
    }
  } catch {
    // ignore
  }
}

/**
 * Require authentication - throws if not authenticated.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
