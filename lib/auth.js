import crypto from "node:crypto";

import { createHttpError } from "./http.js";

const PASSWORD_HASH_SIZE = 64;
const PASSWORD_SALT_SIZE = 16;
const JWT_ALGORITHM = "HS256";
const TOKEN_LIFETIME_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 24;

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function encodeBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function timingSafeStringCompare(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function derivePasswordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, PASSWORD_HASH_SIZE, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey.toString("base64url"));
    });
  });
}

function parseJsonOrThrow(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw createHttpError(401, "Invalid token");
  }
}

function signJwtContent(unsignedToken) {
  return crypto.createHmac("sha256", getJwtSecret()).update(unsignedToken).digest("base64url");
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw createHttpError(400, "Password must be at least 8 characters");
  }

  const salt = crypto.randomBytes(PASSWORD_SALT_SIZE).toString("base64url");
  const hash = await derivePasswordHash(password, salt);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidateHash = await derivePasswordHash(password, salt);
  return timingSafeStringCompare(candidateHash, hash);
}

export function generateJwtToken({ userId, role }) {
  const now = Math.floor(Date.now() / 1000);
  const headerPart = encodeBase64Url(
    JSON.stringify({
      alg: JWT_ALGORITHM,
      typ: "JWT",
    }),
  );

  const payloadPart = encodeBase64Url(
    JSON.stringify({
      sub: String(userId),
      role,
      iat: now,
      exp: now + TOKEN_LIFETIME_SECONDS,
    }),
  );

  const unsignedToken = `${headerPart}.${payloadPart}`;
  const signaturePart = signJwtContent(unsignedToken);
  return `${unsignedToken}.${signaturePart}`;
}

export function verifyJwtToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw createHttpError(401, "Authorization token is required");
  }

  const [headerPart, payloadPart, signaturePart, extraPart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extraPart) {
    throw createHttpError(401, "Invalid token");
  }

  const unsignedToken = `${headerPart}.${payloadPart}`;
  const expectedSignature = signJwtContent(unsignedToken);
  if (!timingSafeStringCompare(expectedSignature, signaturePart)) {
    throw createHttpError(401, "Invalid token");
  }

  const header = parseJsonOrThrow(decodeBase64Url(headerPart));
  if (header?.alg !== JWT_ALGORITHM || header?.typ !== "JWT") {
    throw createHttpError(401, "Invalid token");
  }

  const payload = parseJsonOrThrow(decodeBase64Url(payloadPart));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp !== "number" || payload.exp <= now) {
    throw createHttpError(401, "Token expired");
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, "Invalid token");
  }

  if (typeof payload.role !== "string") {
    throw createHttpError(401, "Invalid token");
  }

  return {
    userId,
    role: payload.role,
  };
}

export function readBearerToken(req) {
  const authorization = `${req.headers.authorization || ""}`.trim();
  if (!authorization) {
    throw createHttpError(401, "Authorization header is required");
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!/^Bearer$/i.test(scheme) || !token) {
    throw createHttpError(401, "Authorization header must use Bearer token");
  }

  return token;
}
