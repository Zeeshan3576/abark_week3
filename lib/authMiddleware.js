import { createHttpError } from "./http.js";
import { readBearerToken, verifyJwtToken } from "./auth.js";
import { getUserIdentityById } from "../models/userModel.js";

export async function requireAuth(req) {
  const token = readBearerToken(req);
  const decoded = verifyJwtToken(token);

  const identity = await getUserIdentityById(decoded.userId);
  if (!identity) {
    throw createHttpError(401, "Invalid token user");
  }

  req.auth = {
    userId: identity.id,
    role: identity.role,
  };

  return req.auth;
}

export async function requireRole(req, allowedRoles) {
  const auth = req.auth || (await requireAuth(req));
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw createHttpError(500, "Allowed roles are required");
  }

  if (!allowedRoles.includes(auth.role)) {
    throw createHttpError(403, "Forbidden");
  }

  return auth;
}
