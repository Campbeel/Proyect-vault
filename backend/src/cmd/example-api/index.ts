import "module-alias/register";

import server from "./server";

const port = process.env.PORT || 8080;

// Eliminar server.listen y exportar server si se requiere para tests o importaciones
export default server;
