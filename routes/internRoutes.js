import {
  createIntern,
  deleteIntern,
  getIntern,
  getInterns,
  uploadInternProfileImage,
} from "../controllers/internController.js";
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

export async function handleInternRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = normalizePathname(url.pathname);

  if (pathname === "/interns") {
    await requireAuth(req);

    if (req.method === "POST") {
      await requireRole(req, [ROLE_NAMES.ADMIN]);
      await createIntern(req, res);
      return true;
    }

    if (req.method === "GET") {
      await getInterns(req, res);
      return true;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
    return true;
  }

  const profileMatch = pathname.match(/^\/interns\/([^/]+)\/profile-image$/);
  if (profileMatch) {
    const id = parsePositiveId(profileMatch[1], "Intern id");
    await requireAuth(req);

    if (req.method === "POST") {
      await requireRole(req, [ROLE_NAMES.ADMIN]);
      await uploadInternProfileImage(req, res, id);
      return true;
    }

    sendMethodNotAllowed(res, ["POST"]);
    return true;
  }

  const match = pathname.match(/^\/interns\/([^/]+)$/);
  if (!match) return false;

  const id = parsePositiveId(match[1], "Intern id");
  await requireAuth(req);

  if (req.method === "GET") {
    await getIntern(req, res, id);
    return true;
  }

  if (req.method === "DELETE") {
    await requireRole(req, [ROLE_NAMES.ADMIN]);
    await deleteIntern(req, res, id);
    return true;
  }

  sendMethodNotAllowed(res, ["GET", "DELETE"]);
  return true;
}
