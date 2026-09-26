/**
 * Protects the public driver card, which is all the browser learns about a
 * driver: it must carry every value a guess row shows, with age for the
 * puzzle day and the logo-or-badge decision for the team tile.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { named, recordedRoster } from "../../tests/support/recorded-roster";
import { toCard } from "./api";

const roster = recordedRoster();

describe("toCard", () => {
  it("shows the current team, the age on the day and whether a logo exists", () => {
    const card = toCard(named(roster, "Charles Leclerc"), day("2026-10-16"), (id) => id === "ferrari");
    expect(card).toMatchObject({
      id: "leclerc",
      code: "LEC",
      flag: "mc",
      number: 16,
      age: 29,
      firstSeason: 2018,
      team: { id: "ferrari", name: "Ferrari", hasLogo: true },
    });
    const bottas = toCard(named(roster, "Valtteri Bottas"), day("2026-10-16"), () => false);
    expect(bottas.team).toEqual({ id: "cadillac", name: "Cadillac", badge: "CAD", hasLogo: false });
  });
});
