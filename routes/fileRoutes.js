import { serveUploadFile, streamSampleFile } from "../controllers/fileController.js";
import { normalizePathname } from "../lib/http.js";

export async function handleFileRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = normalizePathname(url.pathname);

  if (req.method === "GET" && pathname === "/file/stream") {
    await streamSampleFile(req, res);
    return true;
  }

  if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/uploads/")) {
    await serveUploadFile(req, res, pathname);
    return true;
  }

  return false;
}
