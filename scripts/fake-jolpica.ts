/**
 * Runs the fake Jolpica API (recorded real responses) on a fixed port, for
 * working offline or smoke-testing a container without hitting api.jolpi.ca.
 *
 * It also answers Wikidata's dates-of-death query with the recorded response.
 *
 * Usage: `npm run fake-jolpica` then start the server with
 *   JOLPICA_BASE_URL=http://127.0.0.1:4010/ergast/f1
 *   WIKIDATA_SPARQL_URL=http://127.0.0.1:4010/wikidata/sparql
 */
import { startFakeJolpica } from "../tests/support/fake-jolpica";

const port = Number(process.env["FAKE_JOLPICA_PORT"] ?? "4010");
const fake = await startFakeJolpica(port);
process.stdout.write(`Fake Jolpica serving recorded data at ${fake.baseUrl}\n`);
process.stdout.write(`Fake Wikidata SPARQL endpoint at ${fake.wikidataUrl}\n`);
