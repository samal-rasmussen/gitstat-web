/**
 * The pie chart (design 10): slices sorted descending, legend hidden,
 * tooltip shows value and percentage.
 */
import { themeColors } from "./palette.js";

/** @type {WeakMap<HTMLCanvasElement, import('chart.js').Chart>} */
const instances = new WeakMap();

/**
 * Render (or update in place) the pie chart on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], values: number[], colors: string[] }} data
 * @returns {void}
 */
export function render(canvas, data) {
  const theme = themeColors();
  const total = data.values.reduce((sum, value) => sum + value, 0);
  const datasets = [
    {
      data: data.values,
      backgroundColor: data.colors,
      borderColor: theme.grid,
      borderWidth: 1,
    },
  ];
  /** @type {import('chart.js').ChartOptions<'pie'>} */
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(item) {
            const value = /** @type {number} */ (item.parsed);
            const share = total === 0 ? 0 : (value / total) * 100;
            return `${item.label}: ${value.toLocaleString()} (${share.toFixed(1)}%)`;
          },
        },
      },
    },
  };
  const existing = instances.get(canvas);
  if (existing !== undefined) {
    existing.data = { labels: data.labels, datasets };
    existing.options = /** @type {typeof existing.options} */ (chartOptions);
    existing.update();
    return;
  }
  instances.set(
    canvas,
    new Chart(canvas, {
      type: "pie",
      data: { labels: data.labels, datasets },
      options: chartOptions,
    }),
  );
}

/**
 * Destroy the chart on a canvas, for component teardown.
 * @param {HTMLCanvasElement} canvas
 * @returns {void}
 */
export function destroy(canvas) {
  instances.get(canvas)?.destroy();
  instances.delete(canvas);
}
