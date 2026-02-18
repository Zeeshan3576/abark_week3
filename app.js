import { createServer } from "node:http";

import { handleFileRoutes } from "./routes/fileRoutes.js";
import { handleUserRoutes } from "./routes/userRoutes.js";
import { sendJson } from "./lib/http.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST;

const server = createServer((req, res) => {
  void routeRequest(req, res);
});

async function routeRequest(req, res) {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/") {
      return sendJson(res, 200, {
        message: "OK",
        endpoints: {
          streamFile: "GET /file/stream",
          createUser: "POST /users",
          listUsers: "GET /users",
          getUser: "GET /users/:id",
          deleteUser: "DELETE /users/:id",
        },
      });
    }

    const handledUsers = await handleUserRoutes(req, res);
    if (handledUsers) return;

    const handled = await handleFileRoutes(req, res);
    if (handled) return;

    return sendJson(res, 404, { error: "Not Found" });
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const statusCode = err?.statusCode || err?.status || 500;
    const message =
      statusCode >= 500 ? "Internal Server Error" : err?.message || "Error";

    sendJson(res, statusCode, { error: message });
  }
}

server.on("error", (err) => {
  console.error(err);
  process.exitCode = 1;
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
