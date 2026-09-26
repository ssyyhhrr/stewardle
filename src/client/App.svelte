<!--
  The page: header, board, then either the guess box or the result, and the
  two dialogs. All state lives in GameController (lib/game.svelte.ts).
-->
<script lang="ts">
  import WifiOff from "@lucide/svelte/icons/wifi-off";
  import { onMount } from "svelte";
  import Board from "./components/Board.svelte";
  import Footer from "./components/Footer.svelte";
  import GuessInput from "./components/GuessInput.svelte";
  import Header from "./components/Header.svelte";
  import Result from "./components/Result.svelte";
  import StatsDialog from "./components/StatsDialog.svelte";
  import TutorialDialog from "./components/TutorialDialog.svelte";
  import { GameController } from "./lib/game.svelte";

  const game = new GameController();

  onMount(() => {
    void game.start();
  });

  const todaysGuesses = $derived(game.status === "won" ? game.rows.length : null);
</script>

<Header
  highContrast={game.save.settings.highContrast}
  onstats={() => (game.statsOpen = true)}
  oncontrast={() => {
    game.toggleHighContrast();
  }}
  onhelp={() => (game.tutorialOpen = true)}
/>

<main>
  {#if game.phase === "unavailable"}
    <section class="unavailable">
      <WifiOff size={40} aria-hidden="true" />
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
    <Board rows={game.rows} />
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
          disabled={game.busy}
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

<style>
  main {
    padding: 0 16px;
  }

  .notice {
    min-height: 1.5em;
    text-align: center;
    color: var(--muted);
  }

  .unavailable {
    max-width: 30em;
    margin: 3em auto;
    text-align: center;
  }
</style>
