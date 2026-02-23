import crypto from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

import { createHttpError, readJsonBody, sendJson } from "../lib/http.js";
import { readMultipartFile } from "../lib/multipart.js";
import {
  createIntern as createInternRecord,
  deleteInternById,
  getInternById,
  listInterns,
  updateInternProfileImagePath,
} from "../models/internModel.js";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
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

function toTrimmedString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMaxProfileImageBytes() {
  const value = Number(process.env.MAX_INTERN_PROFILE_IMAGE_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PROFILE_IMAGE_BYTES;
}

function getImageExtension(originalFilename, mimeType) {
  const extensionFromName = path.extname(originalFilename || "").toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(extensionFromName)) {
    return extensionFromName === ".jpeg" ? ".jpg" : extensionFromName;
  }

  const mapped = IMAGE_EXTENSION_BY_MIME_TYPE[mimeType];
  if (!mapped) throw createHttpError(400, "Unsupported image type");
  return mapped;
}

function toStoredFilename(internId, extension) {
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return `intern-${internId}-${Date.now()}-${randomSuffix}${extension}`;
}

function getStoredFilenameFromPublicPath(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith("/uploads/")) {
    return null;
  }

  const filename = publicPath.slice("/uploads/".length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  return filename;
}

async function removeUploadedFile(publicPath) {
  const filename = getStoredFilenameFromPublicPath(publicPath);
  if (!filename) return;

  const absolutePath = path.resolve(UPLOADS_DIR, filename);
  if (!absolutePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) return;

  try {
    await unlink(absolutePath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("Failed to delete file:", err);
    }
  }
}

export async function createIntern(req, res) {
  const body = await readJsonBody(req);

  const name = toTrimmedString(body.name);
  if (!name) throw createHttpError(400, "Name is required");

  const email = toTrimmedString(body.email)?.toLowerCase();
  if (!email) throw createHttpError(400, "Email is required");
  if (!isValidEmail(email)) throw createHttpError(400, "Email is invalid");

  const intern = await createInternRecord({ name, email });
  sendJson(res, 201, intern);
}

export async function getInterns(req, res) {
  const interns = await listInterns();
  sendJson(res, 200, interns);
}

export async function getIntern(req, res, id) {
  const intern = await getInternById(id, { includeTasks: true });
  if (!intern) throw createHttpError(404, "Intern not found");
  sendJson(res, 200, intern);
}

export async function deleteIntern(req, res, id) {
  const existing = await getInternById(id, { includeTasks: true });
  if (!existing) throw createHttpError(404, "Intern not found");

  const deleted = await deleteInternById(id);
  if (!deleted) throw createHttpError(404, "Intern not found");

  if (existing.profileImagePath) {
    await removeUploadedFile(existing.profileImagePath);
  }

  if (Array.isArray(existing.tasks)) {
    for (const task of existing.tasks) {
      if (task.attachmentPath) {
        await removeUploadedFile(task.attachmentPath);
      }
    }
  }

  sendJson(res, 200, deleted);
}

export async function uploadInternProfileImage(req, res, id) {
  const existingIntern = await getInternById(id);
  if (!existingIntern) throw createHttpError(404, "Intern not found");

  const maxFileBytes = getMaxProfileImageBytes();
  const uploaded = await readMultipartFile(req, {
    fieldName: "image",
    maxFileBytes,
  });

  const mimeType = `${uploaded.mimeType || ""}`.split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createHttpError(400, "Only JPEG, PNG, GIF, and WEBP images are supported");
  }

  const extension = getImageExtension(uploaded.originalFilename, mimeType);
  const filename = toStoredFilename(id, extension);
  const absolutePath = path.join(UPLOADS_DIR, filename);
  const publicPath = `/uploads/${filename}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(absolutePath, uploaded.buffer);

  const updated = await updateInternProfileImagePath(id, publicPath);
  if (!updated) {
    await unlink(absolutePath).catch(() => {});
    throw createHttpError(404, "Intern not found");
  }

  if (existingIntern.profileImagePath && existingIntern.profileImagePath !== publicPath) {
    await removeUploadedFile(existingIntern.profileImagePath);
  }

  sendJson(res, 200, updated);
}
