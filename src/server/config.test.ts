/**
 * Protects the deployment contract: defaults, and clear errors for a bad
 * environment instead of a server that starts wrongly.
 */
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config";

describe("loadConfig", () => {
  it("has sensible defaults", () => {
    expect(loadConfig({}, "/app")).toEqual({
      port: 3000,
      host: "0.0.0.0",
      dataDir: "/app/data",
      staticDir: "/app/dist/client",
      jolpicaBaseUrl: "https://api.jolpi.ca/ergast/f1",
      secret: null,
    });
  });

  it("reads every variable", () => {
    const config = loadConfig(
      {
        PORT: "8080",
        HOST: "127.0.0.1",
        DATA_DIR: "/var/lib/stewardle",
        STATIC_DIR: "/srv/client",
        JOLPICA_BASE_URL: "http://fake/ergast/f1/",
        STEWARDLE_SECRET: "x".repeat(32),
      },
      "/app",
    );
    expect(config).toMatchObject({
      port: 8080,
      host: "127.0.0.1",
      dataDir: "/var/lib/stewardle",
      jolpicaBaseUrl: "http://fake/ergast/f1",
    });
  });

  it("rejects a bad port or a short secret", () => {
    expect(() => loadConfig({ PORT: "http" }, "/app")).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: "70000" }, "/app")).toThrow(/PORT/);
    expect(() => loadConfig({ STEWARDLE_SECRET: "short" }, "/app")).toThrow(/STEWARDLE_SECRET/);
  });
});
