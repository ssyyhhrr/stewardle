/** Client entry point: mounts the Svelte app. */
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("#app element missing from index.html");
mount(App, { target });
