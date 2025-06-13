"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vite_1 = require("vite");
var importCss_mjs_1 = require("./build-script/importCss.mjs");
var plugin_vue_1 = require("@vitejs/plugin-vue");
var node_path_1 = require("node:path");
exports.default = (0, vite_1.defineConfig)({
    plugins: [(0, plugin_vue_1.default)(), (0, importCss_mjs_1.default)("vectorInput")],
    base: "./",
    build: {
        assetsInlineLimit: 0,
        outDir: "./dist-demo/",
        minify: true,
        target: "es2020",
        rollupOptions: {
            input: "./index.html",
        }
    },
    resolve: {
        preserveSymlinks: true,
        alias: [
            { find: "@", replacement: node_path_1.default.resolve(__dirname, "./src") },
            { find: "@exp", replacement: node_path_1.default.resolve(__dirname, "./src/exported") },
            { find: "@apps", replacement: node_path_1.default.resolve(__dirname, "./src/apps") },
            { find: "@t", replacement: node_path_1.default.resolve(__dirname, "./src/types") },
            { find: "@themes", replacement: node_path_1.default.resolve(__dirname, "./src/themes") },
        ],
    },
});
