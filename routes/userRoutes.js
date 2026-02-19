import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
} from "../controllers/userController.js";
import {
  createHttpError,
  normalizePathname,
  sendMethodNotAllowed,
} from "../lib/http.js";
import { requireAuth, requireRole } from "../lib/authMiddleware.js";
import { ROLE_NAMES } from "../lib/roles.js";

export async function handleUserRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = normalizePathname(url.pathname);

  if (pathname === "/users") {
    await requireAuth(req);

    if (req.method === "POST") {
      await createUser(req, res);
      return true;
    }

    if (req.method === "GET") {
      await getUsers(req, res);
      return true;
    }

    sendMethodNotAllowed(res, ["GET", "POST"]);
    return true;
  }

  const match = pathname.match(/^\/users\/([^/]+)$/);
  if (!match) return false;

  const id = Number(match[1]);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, "User id must be a positive integer");
  }

  await requireAuth(req);

  if (req.method === "GET") {
    await getUser(req, res, id);
    return true;
  }

  if (req.method === "DELETE") {
    await requireRole(req, [ROLE_NAMES.ADMIN]);
    await deleteUser(req, res, id);
    return true;
  }

  sendMethodNotAllowed(res, ["GET", "DELETE"]);
  return true;
}
