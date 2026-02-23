import crypto from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

import { createHttpError, readJsonBody, sendJson } from "../lib/http.js";
import { hashPassword } from "../lib/auth.js";
import { readMultipartFile } from "../lib/multipart.js";
import { ROLE_NAMES, isValidRoleName } from "../lib/roles.js";
import {
  createUser as createUserRecord,
  deleteUserById,
  getUserById,
  listUsers,
  updateUserProfileImagePath,
} from "../models/userModel.js";

const PROFILE_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const DEFAULT_MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const IMAGE_EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function getMaxProfileImageBytes() {
  const value = Number(process.env.MAX_PROFILE_IMAGE_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PROFILE_IMAGE_BYTES;
}

function getSafeImageExtension(originalFilename, mimeType) {
  const extensionFromName = path.extname(originalFilename || "").toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName)) {
    return extensionFromName === ".jpeg" ? ".jpg" : extensionFromName;
  }

  const mappedExtension = IMAGE_EXTENSION_BY_MIME_TYPE[mimeType];
  if (!mappedExtension) {
    throw createHttpError(400, "Unsupported image type");
  }

  return mappedExtension;
}

function buildStoredImageFilename(userId, extension) {
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return `user-${userId}-${Date.now()}-${randomSuffix}${extension}`;
}

function getUploadFilenameFromPublicPath(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith("/uploads/")) {
    return null;
  }

  const filename = publicPath.slice("/uploads/".length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  return filename;
}

async function removePreviousProfileImage(publicPath) {
  const filename = getUploadFilenameFromPublicPath(publicPath);
  if (!filename) return;

  const absolutePath = path.resolve(PROFILE_UPLOADS_DIR, filename);
  if (!absolutePath.startsWith(`${PROFILE_UPLOADS_DIR}${path.sep}`)) {
    return;
  }

  try {
    await unlink(absolutePath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("Failed to delete old profile image:", err);
    }
  }
}

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

export async function createUser(req, res) {
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
  const user = await createUserRecord({ name, email, passwordHash, roleName });
  sendJson(res, 201, user);
}

export async function getUsers(req, res) {
  const users = await listUsers();
  sendJson(res, 200, users);
}

export async function getUser(req, res, id) {
  const user = await getUserById(id);
  if (!user) throw createHttpError(404, "User not found");
  sendJson(res, 200, user);
}

export async function deleteUser(req, res, id) {
  const deletedUser = await deleteUserById(id);
  if (!deletedUser) throw createHttpError(404, "User not found");
  sendJson(res, 200, deletedUser);
}

export async function uploadMyProfileImage(req, res) {
  const userId = req.auth?.userId;
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, "Unauthorized");
  }

  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw createHttpError(401, "Invalid token user");
  }

  const maxFileBytes = getMaxProfileImageBytes();
  const file = await readMultipartFile(req, {
    fieldName: "image",
    maxFileBytes,
  });

  const mimeType = `${file.mimeType || ""}`.split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError(400, "Only JPEG, PNG, GIF, and WEBP images are supported");
  }

  const extension = getSafeImageExtension(file.originalFilename, mimeType);
  const storedFilename = buildStoredImageFilename(userId, extension);
  const absolutePath = path.join(PROFILE_UPLOADS_DIR, storedFilename);
  const publicPath = `/uploads/${storedFilename}`;

  await mkdir(PROFILE_UPLOADS_DIR, { recursive: true });
  await writeFile(absolutePath, file.buffer);

  let updatedUser;
  try {
    updatedUser = await updateUserProfileImagePath(userId, publicPath);
  } catch (err) {
    await unlink(absolutePath).catch(() => {});
    throw err;
  }

  if (!updatedUser) {
    await unlink(absolutePath).catch(() => {});
    throw createHttpError(404, "User not found");
  }

  if (existingUser.profileImagePath && existingUser.profileImagePath !== publicPath) {
    await removePreviousProfileImage(existingUser.profileImagePath);
  }

  sendJson(res, 200, updatedUser);
}
