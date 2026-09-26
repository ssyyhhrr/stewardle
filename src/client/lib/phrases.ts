/** Headlines for the end of a game, kept from the original site. */

/** Team-radio calls shown after a win; one is picked at random. */
export const VICTORY_CALLS = [
  "How About That?!",
  "We Are The Champions!",
  "******* Took It!",
  "Si Ragazzi!",
  "You Are The Best!",
  "Yeahhaahh!",
  "We Did It, We Did It!",
  "Du Bist Weltmeister!",
  "Aaahaaa Huh Huh Huh!",
  "I Can't Believe It!",
] as const;

/** Shown after a loss. */
export const DEFEAT_CALL = "Bwoah.";

/** A random victory call. */
export function randomVictoryCall(random: () => number = Math.random): string {
  return VICTORY_CALLS[Math.floor(random() * VICTORY_CALLS.length)] ?? VICTORY_CALLS[0];
}
