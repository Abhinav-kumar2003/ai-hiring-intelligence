/**
 * API helper utilities - consistent JSON responses + error handling.
 */
import { NextResponse } from "next/server";

export function ok(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status: number = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string, details?: unknown) {
  return err(message, 400, details);
}

export function notFound(message: string = "Not found") {
  return err(message, 404);
}

/**
 * Wraps an async API handler with try/catch + auth check.
 */
export function apiHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options: { requireAuth?: boolean } = { requireAuth: true }
): T {
  return (async (...args: any[]) => {
    try {
      if (options.requireAuth) {
        const { requireAuth } = await import("./auth");
        try {
          await requireAuth();
        } catch {
          return unauthorized();
        }
      }
      return await handler(...args);
    } catch (e: any) {
      console.error("API error:", e);
      return err(e?.message || "Internal server error", 500);
    }
  }) as T;
}

/**
 * Parse query params from a Next.js Request URL.
 */
export function getQuery(request: Request, key: string): string | undefined {
  const url = new URL(request.url);
  return url.searchParams.get(key) ?? undefined;
}

/**
 * Parse int query param with default.
 */
export function getIntQuery(request: Request, key: string, defaultValue: number): number {
  const v = getQuery(request, key);
  if (!v) return defaultValue;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}
