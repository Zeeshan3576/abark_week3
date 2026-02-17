import { pipeline } from "node:stream/promises";

import { getLongDocReadStream } from "../services/fileService.js";

export async function streamLongDoc(req, res, next) {
  let fileStream;

  try {
    const { stream, size, filename } = await getLongDocReadStream();
    fileStream = stream;

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Length", size);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    req.on("aborted", () => fileStream?.destroy());
    res.on("close", () => {
      if (!res.writableEnded) fileStream?.destroy();
    });

    await pipeline(fileStream, res);
  } catch (err) {
    if (fileStream) fileStream.destroy();
    next(err);
  }
}
