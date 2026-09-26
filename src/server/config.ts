/**
 * Runtime configuration from environment variables. This is the deployment
 * contract; docs/runtime.md describes each variable for the Ansible side.
 */
import path from "node:path";

/** Settings the server runs with. */
export interface Config {
  readonly port: number;
  readonly host: string;
  /** Where roster.json, history.json and the token secret live. Must be writable and persistent. */
  readonly dataDir: string;
  /** The built client (dist/client). */
  readonly staticDir: string;
  /** Jolpica base URL, without a trailing slash. */
  readonly jolpicaBaseUrl: string;
  /** Token-signing secret; if unset, one is generated and kept in dataDir/secret. */
  readonly secret: string | null;
}

/** Thrown for an unusable environment variable, with a message naming it. */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/**
 * Reads the configuration. `appRoot` is the directory containing dist/ (the
 * default static dir is `<appRoot>/dist/client`).
 */
export function loadConfig(env: NodeJS.ProcessEnv, appRoot: string): Config {
  const port = Number(env["PORT"] ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new ConfigError(`PORT must be 1-65535, got ${String(env["PORT"])}`);
  const secret = env["STEWARDLE_SECRET"] ?? null;
  if (secret !== null && secret.length < 32)
    throw new ConfigError("STEWARDLE_SECRET must be at least 32 characters");
  return {
    port,
    host: env["HOST"] ?? "0.0.0.0",
    dataDir: path.resolve(env["DATA_DIR"] ?? path.join(appRoot, "data")),
    staticDir: path.resolve(env["STATIC_DIR"] ?? path.join(appRoot, "dist/client")),
    jolpicaBaseUrl: (env["JOLPICA_BASE_URL"] ?? "https://api.jolpi.ca/ergast/f1").replace(/\/+$/, ""),
    secret,
  };
}
