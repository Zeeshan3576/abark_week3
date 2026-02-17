import fs from "node:fs";

import { getSampleFileInfo } from "../models/fileModel.js";

export async function streamSampleFile(req, res) {
  const { filePath, filename } = await getSampleFileInfo();

  const fileStream = fs.createReadStream(filePath);

  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        fileStream.off("open", handleOpen);
        fileStream.off("error", handleError);
      };

      const handleOpen = () => {
        cleanup();
        resolve();
      };

      const handleError = (err) => {
        cleanup();
        reject(err);
      };

      fileStream.once("open", handleOpen);
      fileStream.once("error", handleError);
    });
  } catch (err) {
    fileStream.destroy();

    const openFailed = new Error("Unable to open sample file");
    openFailed.statusCode =
      err?.code === "ENOENT" ? 404 : err?.code === "EACCES" ? 403 : 500;
    throw openFailed;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.flushHeaders?.();

  req.on("aborted", () => fileStream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) fileStream.destroy();
  });

  fileStream.on("error", (err) => {
    res.destroy(err);
  });

  fileStream.pipe(res);
}
