/**
 * Series colours and theme colours (design 10). The palette is applied by
 * sorted position so neighbouring series differ; chart text and grid colours
 * read Pico's custom properties so both themes look right.
 */

const PALETTE = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
  "#17becf",
  "#9467bd",
  "#2ca02c",
  "#d62728",
  "#8c564b",
  "#e377c2",
  "#bcbd22",
  "#1f77b4",
  "#ff7f0e",
  "#7f7f7f",
];

/**
 * The colour for a series by its sorted position, cycling.
 * @param {number} index
 * @returns {string}
 */
export function color(index) {
  return PALETTE[index % PALETTE.length];
}

/**
 * Chart text and grid colours from Pico's custom properties.
 * @returns {{ text: string, muted: string, grid: string }}
 */
export function themeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--pico-color").trim(),
    muted: style.getPropertyValue("--pico-muted-color").trim(),
    grid: style.getPropertyValue("--pico-muted-border-color").trim(),
  };
}
