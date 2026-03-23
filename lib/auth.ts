import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

export type AppRole = "admin" | "social";

export type SessionPayload = {
  name: string;
  role: AppRole;
  iat?: number;
  exp?: number;
};

const SESSION_COOKIE = "space_noon_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret(): string {
  return process.env.SESSION_SECRET || "space_noon_dev_secret_change_me";
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function signSession(payload: Omit<SessionPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (!decoded || typeof decoded !== "object") return null;
    const name = typeof decoded.name === "string" ? decoded.name : "";
    const role = decoded.role === "social" ? "social" : decoded.role === "admin" ? "admin" : null;
    if (!name || !role) return null;
    return { name, role };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function canAccessAction(role: AppRole, action: string): boolean {
  if (role === "admin") return true;

  const socialAllowed = new Set<string>([
    "getDashboard",
    "getHallBookings",
    "getVisitors",
    "addBooking",
    "getAvailabilityData",
    "social_checkin",
    "social_addFuture",
    "social_addBooking",
    "social_getHallBookings",
    "social_getDashboard",
    "checkin",
    "addFutureBooking"
  ]);

  return socialAllowed.has(action);
}
