// Lint rules: typescript-eslint's strictest type-aware presets for .ts and
// .svelte files. Formatting is left to Prettier (eslint-config-prettier).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

export default ts.config(
  {
    ignores: ["dist", "coverage", "test-results", "playwright-report"],
  },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  {
    rules: {
      // Numbers in template strings are the normal way to build messages and URLs.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: ts.parser, svelteConfig } },
  },
  {
    files: ["**/*.js"],
    ...ts.configs.disableTypeChecked,
  },
  {
    files: ["src/client/public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
);
