/*
 * Applies the saved theme and contrast before the page first paints, so a
 * light-theme player never sees a flash of dark. Loaded as a plain blocking
 * script because the CSP allows no inline scripts. Once the app has started,
 * lib/display.ts keeps these in step with the settings and the device.
 */
(function () {
  var settings = {};
  try {
    settings = JSON.parse(localStorage.getItem("stewardle") || "{}").settings || {};
  } catch {
    // No storage, or a damaged save: the defaults below apply.
  }
  var theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system";
  if (theme === "system") theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  var root = document.documentElement;
  root.dataset.theme = theme;
  if (settings.highContrast === true) root.classList.add("high-contrast");
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#e1e6ec" : "#0d0f12");
})();
