import os from "node:os";
import path from "node:path";

export function getLocalDataDirectory() {
  if (process.env.LOCAL_DATA_DIR) {
    return process.env.LOCAL_DATA_DIR;
  }

  if (process.env.VERCEL === "1") {
    return path.join(os.tmpdir(), "smart-dis-ai-local-data");
  }

  return path.join(process.cwd(), ".local-data");
}
