import express from "express";

import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import fileRoutes from "./routes/fileRoutes.js";

export function createApp() {
  const app = express();

  app.get("/", (req, res) => {
    res.json({
      message: "OK",
      endpoints: {
        streamLongDoc: "GET /api/files/long-doc",
      },
    });
  });

  app.use("/api/files", fileRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
