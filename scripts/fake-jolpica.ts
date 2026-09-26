/**
 * Runs the fake Jolpica API (recorded real responses) on a fixed port, for
 * working offline or smoke-testing a container without hitting api.jolpi.ca.
 *
 * Usage: `npm run fake-jolpica` then start the server with
 *   JOLPICA_BASE_URL=http://127.0.0.1:4010/ergast/f1
 */
import { startFakeJolpica } from "../tests/support/fake-jolpica";

const port = Number(process.env["FAKE_JOLPICA_PORT"] ?? "4010");
const fake = await startFakeJolpica(port);
process.stdout.write(`Fake Jolpica serving recorded data at ${fake.baseUrl}\n`);
