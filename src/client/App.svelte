<!--
  The page: header, board, then either the guess box or the result, and the
  dialogs. All state lives in GameController (lib/game.svelte.ts).
-->
<script lang="ts">
  import WifiOff from "@lucide/svelte/icons/wifi-off";
  import { onMount } from "svelte";
  import Board from "./components/Board.svelte";
  import Footer from "./components/Footer.svelte";
  import GuessInput from "./components/GuessInput.svelte";
  import Header from "./components/Header.svelte";
  import Result from "./components/Result.svelte";
  import SettingsDialog from "./components/SettingsDialog.svelte";
  import StatsDialog from "./components/StatsDialog.svelte";
  import TutorialDialog from "./components/TutorialDialog.svelte";
  import type { Theme } from "../core/save";
  import { GameController } from "./lib/game.svelte";

  const game = new GameController();

  onMount(() => {
    void game.start();
  });

  const todaysGuesses = $derived(game.status === "won" ? game.rows.length : null);
</script>

<Header
  onstats={() => (game.statsOpen = true)}
  onsettings={() => (game.settingsOpen = true)}
  onhelp={() => (game.tutorialOpen = true)}
/>

<main>
  {#if game.phase === "unavailable"}
    <section class="unavailable">
      <WifiOff size={44} aria-hidden="true" />
      <h2>Stewardle is in the pits</h2>
      <p>Today's puzzle couldn't be loaded. Check your connection and try again.</p>
      <button
        class="btn"
        type="button"
        onclick={() => {
          location.reload();
        }}>Try again</button
      >
    </section>
  {:else}
    <Board rows={game.rows} revealFrom={game.revealFrom} />
    {#if game.phase === "ready" && game.puzzle}
      {#if game.over}
        <Result
          headline={game.headline ?? ""}
          answer={game.answer}
          nextPuzzleAt={game.puzzle.nextPuzzleAt}
          now={() => game.now()}
          onshare={() => game.share()}
          onnextday={() => void game.checkForNewDay()}
        />
      {:else}
        <GuessInput
          drivers={game.puzzle.drivers}
          exclude={game.guessedIds}
          busy={game.busy}
          shakes={game.shakes}
          onguess={(id: string) => void game.guess(id)}
          onreject={() => {
            game.reject();
          }}
        />
      {/if}
      <p class="notice" role="status">{game.notice ?? ""}</p>
    {/if}
  {/if}
</main>

<Footer />

<TutorialDialog
  open={game.tutorialOpen}
  onclose={() => {
    game.closeTutorial();
  }}
/>
<StatsDialog
  open={game.statsOpen}
  stats={game.stats}
  streak={game.streak}
  {todaysGuesses}
  shareText={game.over ? game.shareText() : null}
  onshare={() => game.share()}
  onclose={() => (game.statsOpen = false)}
/>
<SettingsDialog
  open={game.settingsOpen}
  theme={game.save.settings.theme}
  highContrast={game.save.settings.highContrast}
  ontheme={(theme: Theme) => {
    game.setTheme(theme);
  }}
  oncontrast={(on: boolean) => {
    game.setHighContrast(on);
  }}
  onclose={() => (game.settingsOpen = false)}
/>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 14px 16px 16px;
  }

  @media (min-width: 560px) {
    main {
      gap: 28px;
      padding: 28px 16px 16px;
    }
  }

  .notice {
    min-height: 1.5em;
    margin: -8px 0 0;
    text-align: center;
    color: var(--muted);
  }

  .notice:empty {
    min-height: 0;
  }

  .unavailable {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 420px;
    margin-top: 48px;
    text-align: center;
  }

  .unavailable :global(svg) {
    color: var(--muted);
  }

  .unavailable h2 {
    margin: 0;
    font-size: 30px;
    font-style: italic;
    line-height: 1.1;
  }

  .unavailable p {
    margin: 0;
  }

  .unavailable .btn {
    margin-top: 6px;
  }
</style>
