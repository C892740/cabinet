/**
 * Authentication helpers: user sessions for web and desktop clients.
 */

import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "./password";
import { getRepo } from "./repo";
import {
  SESSION_COOKIE,
  hashToken,
  newSessionToken,
  sessionMaxAgeSeconds,
  setCookie,
  clearCookie,
} from "./session";
import type { User } from "./types";

export async function registerUser(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<User> {
  const repo = getRepo();
  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }
  const passwordHash = await hashPassword(input.password);
  return repo.createUser({
    email: input.email,
    displayName: input.displayName,
    passwordHash,
  });
}

export async function authenticate(input: {
  email: string;
  password: string;
}): Promise<User | null> {
  const repo = getRepo();
  const user = await repo.findUserByEmail(input.email);
  if (!user) return null;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return null;
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

export async function startSession(user: User): Promise<void> {
  const repo = getRepo();
  const { token, tokenHash, expiresAt } = newSessionToken();
  await repo.createSession(user.id, tokenHash, expiresAt);
  setCookie(SESSION_COOKIE, token, sessionMaxAgeSeconds());
}

export async function endSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await getRepo().deleteSession(hashToken(token));
  }
  clearCookie(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getRepo().findUserBySessionToken(hashToken(token));
}
