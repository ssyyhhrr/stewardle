/**
 * Protects how Jolpica data becomes the driver pool: who is included, each
 * driver's debut, wins and team history, and who they drive for now. Every
 * clue tile is computed from these fields. Runs on recorded real responses.
 */
import { describe, expect, it } from "vitest";
import { named, recordedRoster, recordedStandings } from "../../tests/support/recorded-roster";
import { UNKNOWN_FLAG } from "./nationalities";
import { JolpicaFormatError, buildRoster, currentTeam, parseLatestRace, parseStandings } from "./roster";

const roster = recordedRoster();
const teamIds = (name: string): string[] => named(roster, name).teams.map((t) => t.id);

describe("buildRoster on recorded data", () => {
  it("includes only drivers with a permanent car number", () => {
    expect(roster.length).toBeGreaterThan(50);
    expect(roster.every((d) => Number.isInteger(d.number) && d.number > 0)).toBe(true);
    expect(roster.some((d) => d.id === "michael_schumacher")).toBe(false);
    expect(roster.some((d) => d.id === "mick_schumacher")).toBe(true);
  });

  it("dates debuts and counts wins from 2000", () => {
    expect(named(roster, "Lewis Hamilton").firstSeason).toBe(2007);
    expect(named(roster, "Fernando Alonso").firstSeason).toBe(2001);
    expect(named(roster, "Jenson Button").firstSeason).toBe(2000);
    expect(named(roster, "Sebastian Vettel").wins).toBe(53);
    expect(named(roster, "Nico Rosberg").wins).toBe(23);
  });

  it("records every team in order, collapsing repeats", () => {
    expect(teamIds("Lewis Hamilton")).toEqual(["mclaren", "mercedes", "ferrari"]);
    expect(teamIds("Fernando Alonso")).toEqual([
      "minardi",
      "renault",
      "mclaren",
      "renault",
      "ferrari",
      "mclaren",
      "alpine",
      "aston",
    ]);
  });

  it("keeps mid-season swaps, and takes the current team from the latest race", () => {
    // 2026: RB, then three races for Red Bull, then back to RB.
    const lawson = named(roster, "Liam Lawson");
    expect(lawson.teams.map((t) => t.id)).toContain("red");
    expect(currentTeam(lawson).id).toBe("rb");
  });

  it("ignores a latest race older than the newest standings", () => {
    const previousSeasonRace = {
      season: 2025,
      entries: [{ driverId: "hulkenberg", constructor: { constructorId: "sauber", name: "Sauber" } }],
    };
    const hulkenberg = buildRoster(recordedStandings(), previousSeasonRace).find(
      (d) => d.id === "hulkenberg",
    );
    expect(hulkenberg && currentTeam(hulkenberg).id).toBe("audi");
  });

  it("gives new teams a brand even though no table entry predates them", () => {
    expect(currentTeam(named(roster, "Valtteri Bottas")).id).toBe("cadillac");
    expect(teamIds("Nico Hülkenberg").slice(-2)).toEqual(["kick", "audi"]);
  });

  it("maps every recorded nationality to a real flag", () => {
    expect(roster.filter((d) => d.flag === UNKNOWN_FLAG).map((d) => d.nationality)).toEqual([]);
    expect(named(roster, "Franco Colapinto").flag).toBe("ar");
  });

  it("does not depend on the order seasons are supplied in", () => {
    const shuffled = [...recordedStandings()].reverse();
    expect(buildRoster(shuffled, null)).toEqual(buildRoster(recordedStandings(), null));
  });
});

describe("currentTeam", () => {
  it("fails loudly for a driver with no teams, which buildRoster never produces", () => {
    expect(() => currentTeam({ ...named(roster, "Lewis Hamilton"), teams: [] })).toThrow(/no team/);
  });
});

describe("parsing", () => {
  it("treats a season with no standings yet as empty", () => {
    const body = { MRData: { StandingsTable: { StandingsLists: [] } } };
    expect(parseStandings(2031, body)).toEqual({ season: 2031, standings: [] });
    expect(parseLatestRace(2031, { MRData: { RaceTable: { Races: [] } } })).toBeNull();
  });

  it("rejects responses that don't match Jolpica's format", () => {
    expect(() => parseStandings(2024, { MRData: {} })).toThrow(JolpicaFormatError);
    expect(() => parseStandings(2024, null)).toThrow(JolpicaFormatError);
    const badDriver = {
      MRData: {
        StandingsTable: { StandingsLists: [{ DriverStandings: [{ wins: "1", Driver: { driverId: 7 } }] }] },
      },
    };
    expect(() => parseStandings(2024, badDriver)).toThrow(/driverId: expected a string/);
  });

  it("ignores seasons before 2000 and non-numeric car numbers", () => {
    const season = recordedStandings().find((s) => s.season === 2024);
    if (!season) throw new Error("2024 not recorded");
    expect(buildRoster([{ ...season, season: 1999 }], null)).toEqual([]);
    const body = {
      MRData: {
        StandingsTable: {
          StandingsLists: [
            {
              DriverStandings: [
                {
                  wins: "0",
                  Driver: {
                    driverId: "x",
                    permanentNumber: "TBC",
                    givenName: "A",
                    familyName: "B",
                    dateOfBirth: "2000-01-01",
                    nationality: "British",
                  },
                  Constructors: [],
                },
              ],
            },
          ],
        },
      },
    };
    expect(parseStandings(2030, body).standings[0]?.driver.permanentNumber).toBeNull();
  });

  it("invents a timing code from the surname when Jolpica has none", () => {
    const season = recordedStandings().find((s) => s.season === 2024);
    if (!season) throw new Error("2024 not recorded");
    const noCodes = {
      ...season,
      standings: season.standings.map((e) => ({ ...e, driver: { ...e.driver, code: null } })),
    };
    const hulkenberg = buildRoster([noCodes], null).find((d) => d.id === "hulkenberg");
    expect(hulkenberg?.code).toBe("HUL");
  });
});
