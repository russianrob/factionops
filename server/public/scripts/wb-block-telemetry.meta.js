// ==UserScript==
// @name         Warboard Block Telemetry
// @namespace    tornwar.com
// @version      0.1.0
// @description  Block Torn PDA's bundled Sentry telemetry to cut WebView CPU + network wake-ups. Two-layer: stubs window.Sentry as a no-op proxy AND drops network calls matching Sentry beacon patterns. Logs block counts to a small overlay so you can verify it's working. Toggle off via Tampermonkey if anything misbehaves.
// @author       warboard
// @match        https://www.torn.com/*
// @downloadURL  https://tornwar.com/scripts/wb-block-telemetry.user.js
// @updateURL    https://tornwar.com/scripts/wb-block-telemetry.meta.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
