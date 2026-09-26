/**
 * Minimal structured logging to stdout/stderr: one JSON object per line, so
 * `docker logs` stays readable and log shippers can parse it.
 */

/** Extra key/value context attached to a log line. */
export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** The logging interface the server uses; tests pass a silent or capturing one. */
export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

function line(level: string, message: string, fields: LogFields | undefined): string {
  return JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
}

/** Logs to the process's stdout (info) and stderr (warn, error). */
export const consoleLogger: Logger = {
  info: (message, fields) => {
    process.stdout.write(line("info", message, fields) + "\n");
  },
  warn: (message, fields) => {
    process.stderr.write(line("warn", message, fields) + "\n");
  },
  error: (message, fields) => {
    process.stderr.write(line("error", message, fields) + "\n");
  },
};

/** Discards everything; for tests. */
export const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
