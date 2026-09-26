# Runtime contract

Everything a deployment (Ansible or otherwise) needs to run Stewardle. The
application doesn't know or care how it is deployed; this is its side of the
contract.

## Artefact

- **Docker image:** `syhr/stewardle:latest` and `syhr/stewardle:<git sha>`,
  published by CI on every push to `main` once the `DOCKERHUB_USERNAME` and
  `DOCKERHUB_TOKEN` repository secrets exist. It's built for `linux/amd64` and
  `linux/arm64`.
- **Building it yourself:**
  - `docker build -t stewardle .` from a checkout.
  - Behind a TLS-inspecting proxy, add
    `--secret id=extra_ca,src=/path/to/ca.pem`.
- **Without Docker:** `npm ci && npm run build` produces `dist/`, which is
  self-contained (the server bundle includes its dependencies). Run it with
  `node dist/server/main.js` on **Node 24+**. `node_modules` isn't needed at
  runtime.

## Process

|            |                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command    | `node dist/server/main.js` (the image's `CMD`)                                                                                                                         |
| User       | `node` (uid 1000) in the image                                                                                                                                         |
| Port       | `PORT`, default **3000**, plain HTTP                                                                                                                                   |
| Health     | `GET /healthz` → `200 {"ok":true,"roster":{"activeFetchedAt":…,"pendingFrom":…}}`; the image has a `HEALTHCHECK` with a 5-minute start period                          |
| Logs       | stdout (info) / stderr (warn, error), one JSON object per line: `{"time","level","message",…}`. Request lines log method, path, status and ms, never tokens or answers |
| Shutdown   | `SIGTERM` closes the listener and exits 0                                                                                                                              |
| Exit codes | `1` on a bad configuration or when the first boot can't get driver data (see below)                                                                                    |

## Environment variables

| Variable           | Default                          | Meaning                                                                                                           |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `PORT`             | `3000`                           | Listening port                                                                                                    |
| `HOST`             | `0.0.0.0`                        | Listening address                                                                                                 |
| `DATA_DIR`         | `<app>/data` (image: `/data`)    | Persistent state; must be writable by the process                                                                 |
| `STATIC_DIR`       | `<app>/dist/client`              | The built client; no need to change it                                                                            |
| `JOLPICA_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Driver data source (no trailing slash)                                                                            |
| `STEWARDLE_SECRET` | _(unset)_                        | Token-signing key, at least 32 characters. If unset, one is generated on first boot and kept in `DATA_DIR/secret` |

## Data directory

Mount it as a volume; the image declares `VOLUME /data`. All files are written
atomically (temp file + rename) with mode `0600`.

| File           | Contents                                                       | If lost                                                                                                              |
| -------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `history.json` | `{"version":1,"answers":{"YYYY-MM-DD":"driverId"}}`            | Today's answer is re-picked (players mid-game see different clues) and the 14-day cooldown restarts. **Back it up.** |
| `roster.json`  | The active driver roster and, after 23:30 UTC, the pending one | Refetched from Jolpica on the next start                                                                             |
| `secret`       | Token-signing key (only when `STEWARDLE_SECRET` is unset)      | Regenerated; every in-progress game restarts                                                                         |

## Network

- **Outbound HTTPS to `api.jolpi.ca`** (or `JOLPICA_BASE_URL`). About 28 requests
  per refresh, spaced 300 ms apart.
  - **First boot** (no `roster.json`): the server retries Jolpica with growing
    pauses for about 5 minutes and **exits 1** if it still has no data. Let the
    supervisor (Docker `restart: unless-stopped`, systemd) restart it.
  - **Later boots** start immediately from `roster.json`, and refresh in the
    background if it's over a day old.
  - **Nightly refresh at 23:30 UTC.** It retries twice, 10 minutes apart. The new
    roster takes effect at the next 00:00 UTC. A failed refresh keeps the current
    roster.
- **Inbound:** HTTP on `PORT`. Put TLS in front of it with a reverse proxy
  (Caddy, nginx, Traefik…).

## Reverse proxy notes

- **Serve it at the site root** of `https://stewardle.com`.
  - Returning players' stats migrate only on the **same origin** as the old
    site (localStorage is per origin).
  - The share text links to the origin the page was loaded from.
  - The service worker is scoped to `/`.
- **The app sets its own caching headers.** `/assets/*` is immutable,
  everything else `no-cache` with ETags, and `/api/*` `no-store`. It also sends
  its own security headers (CSP etc.). Don't override them.
- **No sticky sessions or shared state are needed** beyond `DATA_DIR`. Run a
  single instance per data directory: two instances sharing one directory could
  each pick a different answer on the day's first requests.

## Example (Docker Compose)

```yaml
services:
  stewardle:
    image: syhr/stewardle:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000" # the reverse proxy terminates TLS
    volumes:
      - stewardle-data:/data
volumes:
  stewardle-data:
```

## Upgrading

Pull the new image and recreate the container with the same volume. State
formats are versioned, and unreadable state is dropped in favour of a
refetch rather than crashing.
