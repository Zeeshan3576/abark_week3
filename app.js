import { createServer } from "node:http";

import { handleFileRoutes } from "./routes/fileRoutes.js";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { handleUserRoutes } from "./routes/userRoutes.js";
import { handleInternRoutes } from "./routes/internRoutes.js";
import { handleTaskRoutes } from "./routes/taskRoutes.js";
import { sendJson } from "./lib/http.js";

const port = Number(process.env.PORT) || 3000;

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
          register: "POST /auth/register",
          login: "POST /auth/login",
          streamFile: "GET /file/stream",
          createUser: "POST /users",
          listUsers: "GET /users",
          getUser: "GET /users/:id",
          deleteUser: "DELETE /users/:id",
          uploadProfileImage: "POST /users/me/profile-image",
          getUploadedImage: "GET /uploads/:filename",
          createIntern: "POST /interns",
          listInterns: "GET /interns",
          getIntern: "GET /interns/:id",
          deleteIntern: "DELETE /interns/:id (ADMIN)",
          uploadInternProfileImage: "POST /interns/:id/profile-image (ADMIN)",
          assignTask: "POST /tasks (ADMIN)",
          listTasks: "GET /tasks",
          getTask: "GET /tasks/:id",
          updateTaskStatus: "PATCH /tasks/:id/status",
          deleteTask: "DELETE /tasks/:id (ADMIN)",
          uploadTaskAttachment: "POST /tasks/:id/attachment (ADMIN)",
          streamTaskAttachment: "GET /tasks/:id/attachment/stream",
        },
      });
    }

    const handledAuth = await handleAuthRoutes(req, res);
    if (handledAuth) return;

    const handledUsers = await handleUserRoutes(req, res);
    if (handledUsers) return;

    const handledInterns = await handleInternRoutes(req, res);
    if (handledInterns) return;

    const handledTasks = await handleTaskRoutes(req, res);
    if (handledTasks) return;

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
