/** Client entry point: loads fonts and global styles, then mounts the app. */
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/700.css";
import "@fontsource/titillium-web/900.css";
import "./styles/global.css";
import "./styles/pattern.css";
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("#app element missing from index.html");
mount(App, { target });
