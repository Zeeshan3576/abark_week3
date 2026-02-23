import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { access, stat, mkdir, unlink, writeFile } from "node:fs/promises";

import { createHttpError, readJsonBody, sendJson } from "../lib/http.js";
import { readMultipartFile } from "../lib/multipart.js";
import { isValidTaskStatus, TASK_STATUSES } from "../lib/taskStatus.js";
import {
  createTask as createTaskRecord,
  deleteTaskById,
  getTaskById,
  listTasks,
  updateTaskAttachment,
  updateTaskStatus,
} from "../models/taskModel.js";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const DEFAULT_MAX_TASK_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function toTrimmedString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTaskStatus(value) {
  const raw = toTrimmedString(value)?.toUpperCase();
  if (!raw || !isValidTaskStatus(raw)) {
    throw createHttpError(
      400,
      `Status must be one of: ${Object.values(TASK_STATUSES).join(", ")}`,
    );
  }

  return raw;
}

function getMaxTaskAttachmentBytes() {
  const value = Number(process.env.MAX_TASK_ATTACHMENT_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_TASK_ATTACHMENT_BYTES;
}

function getAttachmentExtension(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/i.test(extension)) {
    return extension;
  }

  return "";
}

function toStoredFilename(taskId, extension) {
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return `task-${taskId}-${Date.now()}-${randomSuffix}${extension}`;
}

function getStoredFilenameFromPublicPath(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith("/uploads/")) {
    return null;
  }

  const filename = publicPath.slice("/uploads/".length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
  return filename;
}

function toAbsoluteUploadPath(publicPath) {
  const filename = getStoredFilenameFromPublicPath(publicPath);
  if (!filename) return null;

  const absolutePath = path.resolve(UPLOADS_DIR, filename);
  if (!absolutePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) return null;
  return absolutePath;
}

async function removeUploadedFile(publicPath) {
  const absolutePath = toAbsoluteUploadPath(publicPath);
  if (!absolutePath) return;

  try {
    await unlink(absolutePath);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("Failed to delete task attachment:", err);
    }
  }
}

export async function createTask(req, res) {
  const body = await readJsonBody(req);

  const title = toTrimmedString(body.title);
  if (!title) throw createHttpError(400, "Title is required");

  const description = body.description === undefined ? null : toTrimmedString(body.description);
  if (body.description !== undefined && description === null) {
    throw createHttpError(400, "Description must be a non-empty string when provided");
  }

  const internId = Number(body.internId);
  if (!Number.isInteger(internId) || internId <= 0) {
    throw createHttpError(400, "internId must be a positive integer");
  }

  const task = await createTaskRecord({ title, description, internId });
  sendJson(res, 201, task);
}

export async function getTasks(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const internIdParam = url.searchParams.get("internId");

  let internId;
  if (internIdParam !== null) {
    internId = Number(internIdParam);
    if (!Number.isInteger(internId) || internId <= 0) {
      throw createHttpError(400, "internId query param must be a positive integer");
    }
  }

  const tasks = await listTasks({ internId });
  sendJson(res, 200, tasks);
}

export async function getTask(req, res, id) {
  const task = await getTaskById(id);
  if (!task) throw createHttpError(404, "Task not found");
  sendJson(res, 200, task);
}

export async function updateTaskStatusById(req, res, id) {
  const body = await readJsonBody(req);
  const status = normalizeTaskStatus(body.status);

  const task = await updateTaskStatus(id, status);
  if (!task) throw createHttpError(404, "Task not found");

  sendJson(res, 200, task);
}

export async function deleteTask(req, res, id) {
  const deleted = await deleteTaskById(id);
  if (!deleted) throw createHttpError(404, "Task not found");

  if (deleted.attachmentPath) {
    await removeUploadedFile(deleted.attachmentPath);
  }

  sendJson(res, 200, deleted);
}

export async function uploadTaskAttachment(req, res, id) {
  const existingTask = await getTaskById(id);
  if (!existingTask) throw createHttpError(404, "Task not found");

  const maxFileBytes = getMaxTaskAttachmentBytes();
  const uploaded = await readMultipartFile(req, {
    fieldName: "attachment",
    maxFileBytes,
  });

  const extension = getAttachmentExtension(uploaded.originalFilename);
  const storedFilename = toStoredFilename(id, extension);
  const absolutePath = path.join(UPLOADS_DIR, storedFilename);
  const publicPath = `/uploads/${storedFilename}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(absolutePath, uploaded.buffer);

  const updated = await updateTaskAttachment(id, {
    attachmentPath: publicPath,
    attachmentOriginalName: uploaded.originalFilename,
    attachmentMimeType: uploaded.mimeType,
  });

  if (!updated) {
    await unlink(absolutePath).catch(() => {});
    throw createHttpError(404, "Task not found");
  }

  if (existingTask.attachmentPath && existingTask.attachmentPath !== publicPath) {
    await removeUploadedFile(existingTask.attachmentPath);
  }

  sendJson(res, 200, updated);
}

export async function streamTaskAttachment(req, res, id) {
  const task = await getTaskById(id);
  if (!task) throw createHttpError(404, "Task not found");
  if (!task.attachmentPath) throw createHttpError(404, "Task attachment not found");

  const absolutePath = toAbsoluteUploadPath(task.attachmentPath);
  if (!absolutePath) throw createHttpError(404, "Task attachment not found");

  let fileStat;
  try {
    fileStat = await stat(absolutePath);
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw createHttpError(404, "Task attachment not found");
    }
    throw err;
  }

  if (!fileStat.isFile()) {
    throw createHttpError(404, "Task attachment not found");
  }

  try {
    await access(absolutePath, fs.constants.R_OK);
  } catch (err) {
    throw createHttpError(
      err?.code === "EACCES" ? 403 : 500,
      "Unable to read task attachment",
    );
  }

  const stream = fs.createReadStream(absolutePath);
  const contentType = task.attachmentMimeType || "application/octet-stream";
  const downloadName = `${task.attachmentOriginalName || path.basename(absolutePath)}`
    .replace(/[\r\n"]/g, "_")
    .trim() || "attachment";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", fileStat.size);
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.flushHeaders?.();

  req.on("aborted", () => stream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) stream.destroy();
  });

  stream.on("error", (err) => {
    res.destroy(err);
  });

  stream.pipe(res);
}
