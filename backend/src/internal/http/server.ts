import http from "http";

// third-party
import bodyParser from "body-parser";
import cors from "cors";
import express, { Express } from "express";
import morgan from "morgan";

declare module "http" {
  interface IncomingMessage {
    body?: any;
    query?: any;
    params?: any;
    _startAt?: [number, number];
  }
}

const allowedOrigins = ["http://localhost:3000", "https://localhost:3000"];

export function createServer(): { app: Express; server: http.Server } {
  const app = express();

  // base configuration
  app.use(cors({ origin: allowedOrigins }));
  app.use(bodyParser.json());

  // Middleware para manejar errores de body-parser
  app.use(
    (err: SyntaxError & { status?: number }, req: any, res: any, next: any) => {
      if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ message: "Invalid JSON body" });
      }
      next();
    }
  );

  app.use((req: any, res: any, next: any) => {
    if (req.method === "POST" && !req.body) {
      return res.status(400).json({ message: "Request body is required" });
    }
    next();
  });

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, access-control-allow-origin, x-api-key"
    );
    if (req.method === "OPTIONS") {
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE"
      );
    }
    next();
  });

  // morgan logger
  morgan.token("body", (req) => JSON.stringify(req.body));
  morgan.token("response-time", (req) => {
    const diff = process.hrtime(req._startAt);
    const time = diff[0] * 1e3 + diff[1] * 1e-6;
    return time.toFixed(3);
  });
  morgan.token("status", (req, res) => res.statusCode.toString());
  app.use((req, res, next) => {
    req._startAt = process.hrtime();
    res.on("finish", () => {
      const diff = process.hrtime(req._startAt);
      const time = diff[0] * 1e3 + diff[1] * 1e-6;
      console.log(`Response time: ${time.toFixed(3)} ms`);
    });
    next();
  });
  app.use(
    morgan(
      ":method :url :status :res[content-length] - :response-time ms :body"
    )
  );

  const server = http.createServer(app);

  return { app, server };
}
