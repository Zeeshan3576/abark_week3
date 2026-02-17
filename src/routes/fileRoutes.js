import { Router } from "express";

import { streamLongDoc } from "../controllers/fileController.js";

const router = Router();

router.get("/long-doc", streamLongDoc);

export default router;
