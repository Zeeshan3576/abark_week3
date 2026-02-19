import { createHttpError, readJsonBody, sendJson } from "../lib/http.js";
import { generateJwtToken, hashPassword, verifyPassword } from "../lib/auth.js";
import { ROLE_NAMES, isValidRoleName } from "../lib/roles.js";
import { createUser, getUserByEmailForAuth } from "../models/userModel.js";

function toTrimmedString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readPassword(value) {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

function normalizeRole(rawRole) {
  if (rawRole === undefined) return ROLE_NAMES.USER;
  const role = toTrimmedString(rawRole)?.toUpperCase();
  if (!role || !isValidRoleName(role)) {
    throw createHttpError(400, "Role must be USER or ADMIN");
  }

  return role;
}

export async function register(req, res) {
  const body = await readJsonBody(req);

  const name = toTrimmedString(body.name);
  if (!name) throw createHttpError(400, "Name is required");

  const email = toTrimmedString(body.email)?.toLowerCase();
  if (!email) throw createHttpError(400, "Email is required");
  if (!isValidEmail(email)) throw createHttpError(400, "Email is invalid");

  const password = readPassword(body.password);
  if (!password) throw createHttpError(400, "Password is required");

  const roleName = normalizeRole(body.role);
  const passwordHash = await hashPassword(password);
  const user = await createUser({ name, email, passwordHash, roleName });
  const token = generateJwtToken({ userId: user.id, role: user.role });

  sendJson(res, 201, { user, token });
}

export async function login(req, res) {
  const body = await readJsonBody(req);

  const email = toTrimmedString(body.email)?.toLowerCase();
  if (!email) throw createHttpError(400, "Email is required");

  const password = readPassword(body.password);
  if (!password) throw createHttpError(400, "Password is required");

  const user = await getUserByEmailForAuth(email);
  if (!user) throw createHttpError(401, "Invalid email or password");

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) throw createHttpError(401, "Invalid email or password");

  const token = generateJwtToken({ userId: user.id, role: user.role });

  sendJson(res, 200, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  });
}
