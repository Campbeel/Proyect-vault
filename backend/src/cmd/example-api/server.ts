import { createServer } from "../../internal/http/server";
import { PROJECT_ID, validateRequiredEnvs } from "../../internal/config";

// validate required envs
validateRequiredEnvs();

// http
const { app, server } = createServer();

export default server;
