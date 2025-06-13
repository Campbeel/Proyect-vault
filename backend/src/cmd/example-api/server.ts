// internal
import { http, config } from "@internal";

// validate required envs
config.validateRequiredEnvs();

// http
const { app, server } = http.createServer();

http.createExampleRouter(app, {});

export default server;
