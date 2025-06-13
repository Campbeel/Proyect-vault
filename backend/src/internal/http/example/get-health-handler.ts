// Express
import { Request, Response } from "express";

// Context
import { Context } from "./routes";

export const getHealthHandler = (ctx: Context) => {
  return async (req: Request, res: Response) => {
    res.json({ message: "System is running" });
  };
};
