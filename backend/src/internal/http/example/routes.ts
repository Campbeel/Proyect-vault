// third-party
import { Express, Router } from "express";

// Internal

// Handlers
import { getHealthHandler } from "./get-health-handler";

// Context
export type Context = {};

// Routes
export function createExampleRouter(router: Express, ctx: Context) {
  const exampleRouter = Router();

  exampleRouter.get("/health", getHealthHandler(ctx));

  router.use("/example", exampleRouter);
}
