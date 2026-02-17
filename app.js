import { createServer } from "node:http";

import { handleFileRoutes } from "./routes/fileRoutes.js";

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
        },
      });
    }

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

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

server.on("error", (err) => {
  console.error(err);
  process.exitCode = 1;
});

const displayHost = host || "localhost";
if (host) {
  server.listen(port, host, () => {
    console.log(`Server listening on http://${displayHost}:${port}`);
  });
} else {
  server.listen(port, () => {
    console.log(`Server listening on http://${displayHost}:${port}`);
  });
}
