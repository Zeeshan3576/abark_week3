import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  streamTaskAttachment,
  updateTaskStatusById,
  uploadTaskAttachment,
} from "../controllers/taskController.js";
import {
  createHttpError,
  normalizePathname,
  sendMethodNotAllowed,
} from "../lib/http.js";
import { requireAuth, requireRole } from "../lib/authMiddleware.js";
import { ROLE_NAMES } from "../lib/roles.js";

function parsePositiveId(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, `${name} must be a positive integer`);
  }

  return id;
}

export async function handleTaskRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = normalizePathname(url.pathname);

  if (pathname === "/tasks") {
    await requireAuth(req);

    if (req.method === "POST") {
      await requireRole(req, [ROLE_NAMES.ADMIN]);
      await createTask(req, res);
      return true;
    }

    if (req.method === "GET") {
      await getTasks(req, res);
      return true;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
    return true;
  }

  const streamMatch = pathname.match(/^\/tasks\/([^/]+)\/attachment\/stream$/);
  if (streamMatch) {
    const id = parsePositiveId(streamMatch[1], "Task id");
    await requireAuth(req);

    if (req.method === "GET") {
      await streamTaskAttachment(req, res, id);
      return true;
    }

    sendMethodNotAllowed(res, ["GET"]);
    return true;
  }

  const attachmentMatch = pathname.match(/^\/tasks\/([^/]+)\/attachment$/);
  if (attachmentMatch) {
    const id = parsePositiveId(attachmentMatch[1], "Task id");
    await requireAuth(req);

    if (req.method === "POST") {
      await requireRole(req, [ROLE_NAMES.ADMIN]);
      await uploadTaskAttachment(req, res, id);
      return true;
    }

    sendMethodNotAllowed(res, ["POST"]);
    return true;
  }

  const statusMatch = pathname.match(/^\/tasks\/([^/]+)\/status$/);
  if (statusMatch) {
    const id = parsePositiveId(statusMatch[1], "Task id");
    await requireAuth(req);

    if (req.method === "PATCH") {
      await updateTaskStatusById(req, res, id);
      return true;
    }

    sendMethodNotAllowed(res, ["PATCH"]);
    return true;
  }

  const match = pathname.match(/^\/tasks\/([^/]+)$/);
  if (!match) return false;

  const id = parsePositiveId(match[1], "Task id");
  await requireAuth(req);

  if (req.method === "GET") {
    await getTask(req, res, id);
    return true;
  }

  if (req.method === "DELETE") {
    await requireRole(req, [ROLE_NAMES.ADMIN]);
    await deleteTask(req, res, id);
    return true;
  }

  sendMethodNotAllowed(res, ["GET", "DELETE"]);
  return true;
}
