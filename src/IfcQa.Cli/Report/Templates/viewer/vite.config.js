import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/app.js"),
            name: "IfcQaViewer",
            formats: ["iife"],
            fileName: () => "viewer.bundle.js",
        },
        outDir: ".",
        emptyOutDir: false,
        rollupOptions: { output: { entryFileNames: "viewer.bundle.js" } }
    },
});