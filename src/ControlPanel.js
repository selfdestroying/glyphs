import { DEFAULT_OPTIONS, OPTION_CONSTRAINTS } from "./defaults.js";
import { DEFAULT_PRESETS } from "./presets.js";

/**
 * Description of every control rendered by the panel. Grouped into sections
 * so the UI can render collapsible groups.
 *
 * The schema is intentionally declarative – adding or removing a control is
 * a single entry in this array and does not require additional wiring.
 *
 * @typedef {"range" | "color" | "switch" | "text"} ControlKind
 *
 * @typedef {{
 *     id: string,
 *     kind: ControlKind,
 *     label: string,
 *     hint?: string,
 * }} ControlSchema
 *
 * @typedef {{
 *     id: string,
 *     title: string,
 *     controls: ControlSchema[],
 *     open?: boolean,
 *     variant?: "grid" | "stack",
 * }} SectionSchema
 */

/** @type {SectionSchema[]} */
export const DEFAULT_SCHEMA = [
  {
    id: "main",
    title: "Main",
    open: true,
    variant: "stack",
    controls: [
      {
        id: "pointerInteraction",
        kind: "switch",
        label: "Pointer interaction",
        hint: "Enable cursor-driven control",
      },
      { id: "fontSize", kind: "range", label: "Size" },
      {
        id: "cellSize",
        kind: "range",
        label: "Cell size",
        hint: "Auto follows font size",
      },
      { id: "sizeBoost", kind: "range", label: "Active size boost" },
      { id: "spacingBoost", kind: "range", label: "Active spacing" },
      { id: "startOpacity", kind: "range", label: "Base opacity" },
    ],
  },
  {
    id: "alphabet",
    title: "Alphabet",
    open: false,
    variant: "stack",
    controls: [
      {
        id: "alphabet",
        kind: "text",
        label: "Glyphs",
        hint: "Characters drawn in the grid",
      },
    ],
  },
  {
    id: "interaction",
    title: "Interaction",
    variant: "grid",
    controls: [
      { id: "innerRadius", kind: "range", label: "Inner radius" },
      { id: "outerRadius", kind: "range", label: "Outer radius" },
      { id: "interactionSoftness", kind: "range", label: "Softness" },
      { id: "followSpeed", kind: "range", label: "Follow" },
      { id: "fadeInSpeed", kind: "range", label: "Fade in" },
      { id: "fadeOutSpeed", kind: "range", label: "Fade out" },
    ],
  },
  {
    id: "chars",
    title: "Characters",
    variant: "grid",
    controls: [
      { id: "baseCharChangeChance", kind: "range", label: "Base change" },
      { id: "activeCharChangeChance", kind: "range", label: "Active change" },
      { id: "charChangeSpeed", kind: "range", label: "Noise speed" },
      { id: "charChangeInterval", kind: "range", label: "Interval" },
    ],
  },
  {
    id: "color",
    title: "Color",
    variant: "grid",
    controls: [
      { id: "colorMin", kind: "color", label: "Base color" },
      { id: "colorMax", kind: "color", label: "Active color" },
    ],
  },
  {
    id: "glow",
    title: "Glow",
    variant: "stack",
    controls: [
      { id: "startGlow", kind: "range", label: "Base glow" },
      { id: "glow", kind: "range", label: "Boost" },
      { id: "glowColorMin", kind: "color", label: "Base color" },
      { id: "glowColorMax", kind: "color", label: "Active color" },
    ],
  },
  {
    id: "trail",
    title: "Trail",
    variant: "stack",
    controls: [{ id: "motionBlur", kind: "range", label: "Motion blur" }],
  },
];

/**
 * Format a numeric value for the value label. Uses at most 3 decimals for
 * values smaller than 1 and integer display otherwise.
 */
function formatValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Format a range value for display in the value pill. Handles option-level
 * sentinels — currently only `cellSize: 0`, which means "auto-follow
 * fontSize". The slider itself is constrained above 0 to prevent extreme
 * grid densities, but the underlying option may still be 0 (defaults,
 * presets, manual API calls) and we want to communicate that clearly.
 */
function formatRangeValue(key, value) {
  if (key === "cellSize" && value === 0) return "Auto";
  return formatValue(value);
}

function makeEl(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === "text") el.textContent = String(v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  return el;
}

/**
 * A schema-driven control panel for a {@link DigitsBackground} instance.
 *
 * ```js
 * const panel = new ControlPanel(document.getElementById("panel"), bg);
 * // or with a custom schema:
 * new ControlPanel(host, bg, { schema: mySchema, onReset: () => ... });
 * ```
 */
export class ControlPanel {
  /**
   * @param {HTMLElement} host
   * @param {import("./DigitsBackground.js").DigitsBackground} background
   * @param {{
   *     schema?: SectionSchema[],
   *     constraints?: typeof OPTION_CONSTRAINTS,
   *     defaults?: typeof DEFAULT_OPTIONS,
   *     presets?: import("./presets.js").Preset[],
   *     showPresets?: boolean,
   *     defaultPreset?: string,
   *     title?: string,
   *     subtitle?: string,
   *     showReset?: boolean,
   *     showFps?: boolean,
   *     onReset?: () => void,
   *     onPreset?: (preset: import("./presets.js").Preset) => void,
   * }} [options]
   */
  constructor(host, background, options = {}) {
    if (!host || typeof host !== "object") {
      throw new TypeError("ControlPanel: host element is required");
    }
    if (!background) {
      throw new TypeError("ControlPanel: background instance is required");
    }

    this.host = host;
    this.background = background;
    this.schema = options.schema || DEFAULT_SCHEMA;
    this.constraints = options.constraints || OPTION_CONSTRAINTS;
    this.defaults = options.defaults || DEFAULT_OPTIONS;
    this.presets = options.presets || DEFAULT_PRESETS;
    this.showPresets = options.showPresets !== false && this.presets.length > 0;
    this.showReset = options.showReset !== false;
    this.showFps = options.showFps !== false;
    this.onReset = options.onReset;
    this.onPreset = options.onPreset;

    this._elements = new Map(); // key -> { input, value }
    this._presetButtons = new Map(); // id -> HTMLButtonElement
    this._activePresetId = null;
    this._applyingPreset = false;
    this._fpsEl = null;
    this._fpsTimer = 0;

    this._render({
      title: options.title || "Controls",
      subtitle: options.subtitle || "Settings grouped by purpose",
    });
    this._syncAll();

    if (this.showFps) this._startFpsTicker();

    if (options.defaultPreset) {
      this.applyPreset(options.defaultPreset);
    }
  }

  /** Destroy the panel, remove its DOM and stop the FPS ticker. */
  destroy() {
    if (this._fpsTimer) {
      clearInterval(this._fpsTimer);
      this._fpsTimer = 0;
    }
    this._elements.clear();
    this._presetButtons.clear();
    this.host.innerHTML = "";
  }

  /** Refresh input values from the background options. */
  sync() {
    this._syncAll();
  }

  /**
   * Apply a preset by id. Returns the preset that was applied,
   * or `undefined` if no matching preset was found.
   * @param {string} id
   */
  applyPreset(id) {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return undefined;

    this._applyingPreset = true;
    try {
      this.background.resetOptions(preset.options || {});
    } finally {
      this._applyingPreset = false;
    }

    this._activePresetId = preset.id;
    this._syncAll();
    this._syncPresetButtons();

    if (typeof this.onPreset === "function") this.onPreset(preset);
    return preset;
  }

  /** Returns the currently active preset, or `null` if none is active. */
  getActivePreset() {
    if (!this._activePresetId) return null;
    return this.presets.find((p) => p.id === this._activePresetId) || null;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  _render({ title, subtitle }) {
    const host = this.host;
    host.classList.add("dbg-panel");
    host.setAttribute("aria-label", "Digits background control panel");
    host.innerHTML = "";

    const header = makeEl("header", "dbg-panel__header");
    const titleWrap = makeEl("div", "dbg-panel__title");
    titleWrap.appendChild(makeEl("h2", null, { text: title }));
    if (subtitle) {
      titleWrap.appendChild(
        makeEl("p", "dbg-panel__subtitle", { text: subtitle }),
      );
    }
    header.appendChild(titleWrap);

    const headerActions = makeEl("div", "dbg-panel__actions");
    if (this.showFps) {
      this._fpsEl = makeEl("span", "dbg-panel__fps", {
        text: "-- FPS",
        title: "Frames per second",
        "aria-live": "polite",
      });
      headerActions.appendChild(this._fpsEl);
    }
    if (this.showReset) {
      const btn = makeEl("button", "dbg-panel__reset", {
        type: "button",
        text: "Reset",
        title: "Reset to defaults",
      });
      btn.addEventListener("click", () => this._handleReset());
      headerActions.appendChild(btn);
    }
    header.appendChild(headerActions);
    host.appendChild(header);

    if (this.showPresets) {
      host.appendChild(this._renderPresets());
    }

    const body = makeEl("div", "dbg-panel__body");
    for (const section of this.schema) {
      body.appendChild(this._renderSection(section));
    }
    host.appendChild(body);
  }

  _renderPresets() {
    const wrap = makeEl("div", "dbg-panel__presets");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Presets");

    const label = makeEl("span", "dbg-panel__presets-label", {
      text: "Presets",
    });
    wrap.appendChild(label);

    const list = makeEl("div", "dbg-panel__presets-list");
    for (const preset of this.presets) {
      const btn = makeEl("button", "dbg-preset", {
        type: "button",
        text: preset.name,
        title: preset.description || preset.name,
        "data-preset": preset.id,
        "aria-pressed": "false",
      });
      btn.addEventListener("click", () => this.applyPreset(preset.id));
      this._presetButtons.set(preset.id, btn);
      list.appendChild(btn);
    }
    wrap.appendChild(list);
    return wrap;
  }

  _renderSection(section) {
    const details = makeEl("details", "dbg-section");
    if (section.open) details.open = true;

    const summary = makeEl("summary", "dbg-section__summary");
    summary.appendChild(
      makeEl("span", "dbg-section__title", { text: section.title }),
    );
    summary.appendChild(makeEl("span", "dbg-section__chevron"));
    details.appendChild(summary);

    const content = makeEl(
      "div",
      `dbg-section__content${
        section.variant === "grid" ? " dbg-section__content--grid" : ""
      }`,
    );
    for (const control of section.controls) {
      content.appendChild(this._renderControl(control));
    }
    details.appendChild(content);

    return details;
  }

  _renderControl(schema) {
    const control = makeEl("div", `dbg-control dbg-control--${schema.kind}`);
    if (schema.kind === "switch") {
      control.classList.add("dbg-control--switch");
    }

    const labelWrap = makeEl("label", "dbg-control__label");
    labelWrap.setAttribute("for", `dbg-${schema.id}`);

    const titleGroup = makeEl("span", "dbg-control__label-text");
    titleGroup.appendChild(makeEl("span", null, { text: schema.label }));
    if (schema.hint) {
      titleGroup.appendChild(
        makeEl("span", "dbg-control__hint", { text: schema.hint }),
      );
    }
    labelWrap.appendChild(titleGroup);

    const valueEl = makeEl("span", "dbg-control__value");
    if (schema.kind !== "switch") labelWrap.appendChild(valueEl);

    control.appendChild(labelWrap);

    let input;
    if (schema.kind === "range") {
      const c = this.constraints[schema.id] || {};
      input = makeEl("input", "dbg-control__range", {
        type: "range",
        id: `dbg-${schema.id}`,
        min: c.min ?? 0,
        max: c.max ?? 1,
        step: c.step ?? 0.01,
      });
    } else if (schema.kind === "color") {
      input = makeEl("input", "dbg-control__color", {
        type: "color",
        id: `dbg-${schema.id}`,
      });
    } else if (schema.kind === "switch") {
      input = makeEl("input", "dbg-control__switch", {
        type: "checkbox",
        id: `dbg-${schema.id}`,
        role: "switch",
      });
    } else if (schema.kind === "text") {
      input = makeEl("textarea", "dbg-control__text", {
        id: `dbg-${schema.id}`,
        rows: 2,
        spellcheck: false,
        autocomplete: "off",
        autocapitalize: "off",
        autocorrect: "off",
      });
    } else {
      throw new RangeError(
        `ControlPanel: unknown control kind "${schema.kind}"`,
      );
    }

    this._bindInput(schema, input, valueEl);
    control.appendChild(input);

    return control;
  }

  _bindInput(schema, input, valueEl) {
    const key = schema.id;
    const bg = this.background;

    const write = (raw) => {
      // Any manual change clears the active preset (unless we're the
      // ones applying a preset right now).
      if (!this._applyingPreset && this._activePresetId !== null) {
        this._activePresetId = null;
        this._syncPresetButtons();
      }
      if (schema.kind === "range") {
        const num = Number(raw);
        bg.setOption(key, num);
        valueEl.textContent = formatRangeValue(key, num);
      } else if (schema.kind === "color") {
        bg.setOption(key, raw);
        valueEl.textContent = String(raw).toUpperCase();
      } else if (schema.kind === "switch") {
        bg.setOption(key, Boolean(raw));
      } else if (schema.kind === "text") {
        const str = String(raw);
        bg.setOption(key, str);
        if (valueEl) {
          valueEl.textContent = `${[...str].length} chars`;
        }
      }
    };

    if (schema.kind === "switch") {
      input.addEventListener("change", (e) => write(e.currentTarget.checked));
    } else {
      input.addEventListener("input", (e) => write(e.currentTarget.value));
    }

    this._elements.set(key, { input, valueEl, kind: schema.kind });
  }

  _syncAll() {
    const opts = this.background.getOptions();
    for (const [key, { input, valueEl, kind }] of this._elements) {
      const value = opts[key];
      if (kind === "switch") {
        input.checked = Boolean(value);
      } else if (kind === "range") {
        input.value = String(value);
        if (valueEl) valueEl.textContent = formatRangeValue(key, Number(value));
      } else if (kind === "color") {
        input.value = String(value);
        if (valueEl) valueEl.textContent = String(value).toUpperCase();
      } else if (kind === "text") {
        const str = String(value ?? "");
        if (input.value !== str) input.value = str;
        if (valueEl) {
          valueEl.textContent = `${[...str].length} chars`;
        }
      }
    }
  }

  _syncPresetButtons() {
    for (const [id, btn] of this._presetButtons) {
      const active = id === this._activePresetId;
      btn.classList.toggle("dbg-preset--active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  _handleReset() {
    this._applyingPreset = true;
    try {
      this.background.resetOptions();
    } finally {
      this._applyingPreset = false;
    }
    this._activePresetId = null;
    this._syncAll();
    this._syncPresetButtons();
    if (typeof this.onReset === "function") this.onReset();
  }

  _startFpsTicker() {
    this._fpsTimer = setInterval(() => {
      if (!this._fpsEl) return;
      const fps = this.background.getFps();
      this._fpsEl.textContent = fps > 0 ? `${fps} FPS` : "-- FPS";
    }, 500);
  }
}
