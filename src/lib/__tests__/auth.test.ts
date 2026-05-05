// @vitest-environment node
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

// Must be mocked before importing auth.ts
vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ set: mockCookieSet, get: mockCookieGet, delete: mockCookieDelete })
  ),
}));

// Import after mocks are registered
const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.NODE_ENV;
});

test("createSession sets the auth-token cookie", async () => {
  await createSession("user-1", "user@example.com");

  expect(mockCookieSet).toHaveBeenCalledOnce();
  expect(mockCookieSet.mock.calls[0][0]).toBe("auth-token");
});

test("createSession stores a valid JWT containing userId and email", async () => {
  await createSession("user-42", "test@example.com");

  const token = mockCookieSet.mock.calls[0][1] as string;
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("test@example.com");
});

test("createSession sets httpOnly, sameSite, and path cookie options", async () => {
  await createSession("user-1", "user@example.com");

  const options = mockCookieSet.mock.calls[0][2];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession sets secure=false outside production", async () => {
  process.env.NODE_ENV = "test";

  await createSession("user-1", "user@example.com");

  const options = mockCookieSet.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("createSession sets secure=true in production", async () => {
  process.env.NODE_ENV = "production";

  await createSession("user-1", "user@example.com");

  const options = mockCookieSet.mock.calls[0][2];
  expect(options.secure).toBe(true);
});

test("createSession sets cookie expiry ~7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const options = mockCookieSet.mock.calls[0][2];
  const expires: Date = options.expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession JWT expires in ~7 days", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const token = mockCookieSet.mock.calls[0][1] as string;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(payload.exp! * 1000).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(payload.exp! * 1000).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// helpers for getSession tests
async function makeToken(claims: object, expiresIn = "7d") {
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

test("getSession returns null when no cookie is present", async () => {
  mockCookieGet.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns the SessionPayload from a valid token", async () => {
  const token = await makeToken({ userId: "user-99", email: "a@b.com", expiresAt: new Date() });
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-99");
  expect(session!.email).toBe("a@b.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieGet.mockReturnValue({ value: "not.a.valid.jwt" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "a@b.com" }, "-1s");
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("deleteSession deletes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieDelete).toHaveBeenCalledOnce();
  expect(mockCookieDelete).toHaveBeenCalledWith("auth-token");
});

function makeRequest(token?: string) {
  const headers: Record<string, string> = token
    ? { cookie: `auth-token=${token}` }
    : {};
  return new NextRequest("http://localhost/", { headers });
}

test("verifySession returns null when no auth-token cookie", async () => {
  const session = await verifySession(makeRequest());

  expect(session).toBeNull();
});

test("verifySession returns SessionPayload from a valid token", async () => {
  const token = await makeToken({ userId: "user-7", email: "v@v.com", expiresAt: new Date() });

  const session = await verifySession(makeRequest(token));

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-7");
  expect(session!.email).toBe("v@v.com");
});

test("verifySession returns null for a malformed token", async () => {
  const session = await verifySession(makeRequest("not.a.valid.jwt"));

  expect(session).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "a@b.com" }, "-1s");

  const session = await verifySession(makeRequest(token));

  expect(session).toBeNull();
});
