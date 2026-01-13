import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs", "iife"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    treeshake: true,
    noExternal: [/.*/],
    globalName: "Ellipsis",
    platform: "browser",
});
