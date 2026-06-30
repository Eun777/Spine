import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "spine-ai-access";
const PURPOSE = "spine-ai-access-v1";

function signature() {
  const code = process.env.BOOK_SCAN_ACCESS_CODE;
  if (!code) return null;
  return createHmac("sha256", code).update(PURPOSE).digest("hex");
}

export function accessCodeConfigured() {
  return Boolean(process.env.BOOK_SCAN_ACCESS_CODE);
}

export function codeMatches(candidate: string) {
  const expected = process.env.BOOK_SCAN_ACCESS_CODE;
  if (!expected || !candidate) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function grantAiAccess() {
  const value = signature();
  if (!value) return;
  cookies().set(COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function hasAiAccess() {
  const expected = signature();
  const actual = cookies().get(COOKIE)?.value;
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
