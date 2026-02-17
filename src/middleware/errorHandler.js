export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not Found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const statusCode = err?.statusCode || err?.status || 500;
  const message =
    statusCode >= 500 ? "Internal Server Error" : err?.message || "Error";

  res.status(statusCode).json({ error: message });
}
