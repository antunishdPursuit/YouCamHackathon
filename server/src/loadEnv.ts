/** Load the repository-root `.env` regardless of the workspace that starts the script. */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

const ROOT_ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

export function loadRootEnv(): void {
  // Existing process variables still win, which keeps explicit shell overrides useful.
  config({ path: ROOT_ENV_PATH });
}
