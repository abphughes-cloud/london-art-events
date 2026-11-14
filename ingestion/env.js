// Load .env into process.env (Node 20.12+ has this built in).
import fs from "node:fs";
const file = new URL("../.env", import.meta.url);
if (fs.existsSync(file)) process.loadEnvFile(file);
