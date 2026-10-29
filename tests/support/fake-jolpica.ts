/**
 * A stand-in for api.jolpi.ca that replays the responses recorded by
 * scripts/generate-fixtures.ts. It also stands in for Wikidata's SPARQL
 * endpoint (`POST /wikidata/sparql`), answering every query with the recorded
 * dates-of-death response.
 *
 * It accepts both request shapes a client can send:
 *  - origin-form (`GET /ergast/f1/2024/driverStandings.json`), used when a
 *    server is pointed at it through JOLPICA_BASE_URL;
 *  - absolute-form (`GET https://api.jolpi.ca/ergast/f1/...`), which is what
 *    axios < 1.16 sends to an HTTP proxy. That lets the legacy server scrape
 *    this fake through its own unmodified scraper by setting HTTPS_PROXY.
 */
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "../fixtures/jolpica");
const WIKIDATA_FIXTURE = path.resolve(import.meta.dirname, "../fixtures/wikidata/sparql.json");

/** The path the fake answers Wikidata SPARQL queries on; also its key in `requests` and `failPath`. */
export const WIKIDATA_PATH = "wikidata/sparql";

/** A running fake; `baseUrl` is what a client should use as its Jolpica root. */
export interface FakeJolpica {
  readonly baseUrl: string;
  readonly port: number;
  /** What a client should use as its Wikidata SPARQL endpoint (WIKIDATA_SPARQL_URL). */
  readonly wikidataUrl: string;
  /** Every API path requested so far, e.g. `2024/driverStandings.json`, or WIKIDATA_PATH. */
  readonly requests: string[];
  /** Makes every following request fail with this HTTP status (null to heal). */
  failWith(status: number | null): void;
  /** Makes only the next `count` requests fail with `status`. */
  failNext(count: number, status: number): void;
  /** Makes every request for one API path (or WIKIDATA_PATH) fail with `status`. */
  failPath(apiPath: string, status: number): void;
  close(): Promise<void>;
}

/** Maps a request URL to the recorded API path, or null if it isn't a Jolpica URL. */
export function apiPathOf(requestUrl: string): string | null {
  const { pathname } = new URL(requestUrl, "http://fake.invalid");
  const match = /^\/ergast\/f1\/(.+)$/.exec(pathname);
  if (!match?.[1] || match[1].includes("..")) return null;
  return match[1];
}

/** WIKIDATA_PATH for a request to the fake SPARQL endpoint, otherwise null. */
function wikidataPathOf(requestUrl: string): string | null {
  const { pathname } = new URL(requestUrl, "http://fake.invalid");
  return pathname === `/${WIKIDATA_PATH}` ? WIKIDATA_PATH : null;
}

/** Starts the fake on `port` (0 picks a free one). */
export async function startFakeJolpica(port = 0): Promise<FakeJolpica> {
  const requests: string[] = [];
  let failure: number | null = null;
  let failuresLeft = 0;
  let transientStatus = 500;
  const failingPaths = new Map<string, number>();

  const server: Server = createServer((req, res) => {
    const apiPath = apiPathOf(req.url ?? "/") ?? wikidataPathOf(req.url ?? "/");
    if (apiPath) requests.push(apiPath);
    req.resume(); // a SPARQL query arrives as a POST body; the fake doesn't need it
    const reply = (status: number, body: string): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body);
    };
    if (failuresLeft > 0) {
      failuresLeft -= 1;
      reply(transientStatus, JSON.stringify({ detail: "injected transient failure" }));
      return;
    }
    const pathFailure = apiPath === null ? undefined : failingPaths.get(apiPath);
    if (pathFailure !== undefined) {
      reply(pathFailure, JSON.stringify({ detail: "injected path failure" }));
      return;
    }
    if (failure !== null) {
      reply(failure, JSON.stringify({ detail: "injected failure" }));
      return;
    }
    if (apiPath === WIKIDATA_PATH) {
      if (req.method !== "POST") {
        reply(405, JSON.stringify({ detail: "SPARQL queries are POSTed" }));
        return;
      }
      readFile(WIKIDATA_FIXTURE, "utf8").then(
        (body) => {
          reply(200, body);
        },
        () => {
          reply(404, JSON.stringify({ detail: "no Wikidata fixture" }));
        },
      );
      return;
    }
    if (!apiPath) {
      reply(404, JSON.stringify({ detail: "not a Jolpica path" }));
      return;
    }
    readFile(path.join(FIXTURE_DIR, apiPath), "utf8").then(
      (body) => {
        reply(200, body);
      },
      () => {
        reply(404, JSON.stringify({ detail: `no fixture for ${apiPath}` }));
      },
    );
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${actualPort}/ergast/f1`,
    port: actualPort,
    wikidataUrl: `http://127.0.0.1:${actualPort}/${WIKIDATA_PATH}`,
    requests,
    failWith(status) {
      failure = status;
    },
    failNext(count, status) {
      failuresLeft = count;
      transientStatus = status;
    },
    failPath(apiPath, status) {
      failingPaths.set(apiPath, status);
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
