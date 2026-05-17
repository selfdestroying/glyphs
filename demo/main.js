import { DigitsBackground, ControlPanel } from "../src/index.js";

const canvas = document.getElementById("bg");
const panelHost = document.getElementById("panel");

const background = new DigitsBackground(canvas);

new ControlPanel(panelHost, background, {
    defaultPreset: "slate",
});

// Expose for debugging in the browser console.
if (typeof window !== "undefined") {
    window.__digitsBackground = background;
}
