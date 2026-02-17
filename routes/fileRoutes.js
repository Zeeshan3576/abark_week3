import { streamSampleFile } from "../controllers/fileController.js";

export async function handleFileRoutes(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/file/stream") {
    await streamSampleFile(req, res);
    return true;
  }

  return false;
}

