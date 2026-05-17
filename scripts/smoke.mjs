// Lightweight smoke test that avoids a real browser. We stub just enough of
// the canvas surface to exercise the constructor, option updates, lifecycle
// and color helpers. Any thrown exception here fails the CI script.

import { hexToRgb, buildColorLUT, lookupColor } from "../src/color-utils.js";
import { DEFAULT_OPTIONS } from "../src/defaults.js";
import { DigitsBackground } from "../src/DigitsBackground.js";
import { DEFAULT_PRESETS, getPresetById } from "../src/presets.js";

// --- color-utils -----------------------------------------------------------

function assert(cond, msg) {
    if (!cond) throw new Error("assertion failed: " + msg);
}

const white = hexToRgb("#ffffff");
assert(white.r === 255 && white.g === 255 && white.b === 255, "hex white");

const short = hexToRgb("#abc");
assert(short.r === 0xaa && short.g === 0xbb && short.b === 0xcc, "hex short");

let invalid = false;
try {
    hexToRgb("nope");
} catch {
    invalid = true;
}
assert(invalid, "invalid hex throws");

const lut = buildColorLUT("#000000", "#ffffff", 256);
assert(lut.length === 256, "LUT length");
assert(lut[0] === "rgb(0,0,0)", "LUT start");
assert(lut[255] === "rgb(255,255,255)", "LUT end");
assert(lookupColor(lut, 0) === "rgb(0,0,0)", "lookup start");
assert(lookupColor(lut, 1) === "rgb(255,255,255)", "lookup end");
assert(lookupColor(lut, 0.5).startsWith("rgb(128"), "lookup mid");

// --- DigitsBackground ------------------------------------------------------

// Mock enough of the DOM to construct an instance.
const ctxMock = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    fillText() {},
    set shadowBlur(_) {},
    set shadowColor(_) {},
    set shadowOffsetX(_) {},
    set shadowOffsetY(_) {},
    set fillStyle(_) {},
    set globalAlpha(_) {},
    set font(_) {},
    set textAlign(_) {},
    set textBaseline(_) {},
};

const canvasMock = {
    width: 0,
    height: 0,
    style: {},
    clientWidth: 800,
    clientHeight: 600,
    getContext() {
        return ctxMock;
    },
};

globalThis.window = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
};
globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const bg = new DigitsBackground(canvasMock, {
    autoStart: false,
    pointerInteraction: true,
});

assert(bg.getOption("pointerInteraction") === true, "option read");
bg.setOption("fontSize", 48);
assert(bg.getOption("fontSize") === 48, "option write");
bg.setOptions({ colorMin: "#112233", colorMax: "#aabbcc" });
assert(bg.getOption("colorMin") === "#112233", "batched option write");

bg.resetOptions();
assert(
    bg.getOption("fontSize") === DEFAULT_OPTIONS.fontSize,
    "reset restores defaults",
);

// cellSize: 0 (default) should follow fontSize; non-zero should override grid spacing.
assert(bg.getOption("cellSize") === 0, "cellSize default");
bg.setOption("cellSize", 64);
assert(bg.getOption("cellSize") === 64, "cellSize write");
bg.setOption("cellSize", 0);
assert(bg.getOption("cellSize") === 0, "cellSize reset to follow fontSize");

// --- presets ---------------------------------------------------------------

assert(Array.isArray(DEFAULT_PRESETS), "presets are an array");
assert(DEFAULT_PRESETS.length >= 3, "ships with several presets");

const ids = new Set();
for (const preset of DEFAULT_PRESETS) {
    assert(typeof preset.id === "string" && preset.id, "preset has id");
    assert(typeof preset.name === "string" && preset.name, "preset has name");
    assert(
        preset.options && typeof preset.options === "object",
        "preset has options",
    );
    assert(!ids.has(preset.id), `preset id "${preset.id}" is unique`);
    ids.add(preset.id);

    // Every key in the preset must be a known option.
    for (const key of Object.keys(preset.options)) {
        assert(
            key in DEFAULT_OPTIONS,
            `preset "${preset.id}" uses unknown option "${key}"`,
        );
    }

    // Applying via resetOptions must not throw.
    bg.resetOptions(preset.options);
}

assert(getPresetById("matrix") !== undefined, "lookup by id works");
assert(getPresetById("__missing__") === undefined, "missing id returns undef");

// ControlPanel can be smoke-tested without the DOM only superficially —
// the constructor needs an Element host. Skip full panel testing here.

bg.start();
bg.stop();
bg.destroy();

console.log("smoke OK");
