import { login, register } from "../controllers/authController.js";
import { normalizePathname, sendMethodNotAllowed } from "../lib/http.js";

export async function handleAuthRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = normalizePathname(url.pathname);

  if (pathname === "/auth/register") {
    if (req.method === "POST") {
      await register(req, res);
      return true;
    }

    sendMethodNotAllowed(res, ["POST"]);
    return true;
  }

  if (pathname === "/auth/login") {
    if (req.method === "POST") {
      await login(req, res);
      return true;
    }

    sendMethodNotAllowed(res, ["POST"]);
    return true;
  }

  return false;
}
