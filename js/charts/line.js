/**
 * The stacked line chart (design 10): category x axis of bucket labels,
 * stacked y axis unless negatives, `fill` to the previous dataset, legend
 * hidden above 20 series, tooltip in index mode sorted by value with zeroes
 * hidden above 10 series, animation off above a few thousand points.
 */
import { themeColors } from "./palette.js";

/** @type {WeakMap<HTMLCanvasElement, import('chart.js').Chart>} */
const instances = new WeakMap();

/**
 * Render (or update in place) the line chart on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels: string[], series: Series[] }} data
 * @param {{ stacked: boolean }} options
 * @returns {void}
 */
export function render(canvas, data, { stacked }) {
  const theme = themeColors();
  const seriesCount = data.series.length;
  const pointCount = seriesCount * data.labels.length;
  const datasets = data.series.map((series, index) => ({
    label: series.name,
    data: series.values,
    borderColor: series.color,
    backgroundColor: `${series.color}55`,
    fill: stacked ? (index === 0 ? "origin" : "-1") : false,
    borderWidth: 1.5,
    pointRadius: 0,
    pointHitRadius: 8,
  }));
  /** @type {import('chart.js').ChartOptions<'line'>} */
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: pointCount > 3000 ? false : { duration: 300 },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        ticks: { color: theme.muted, maxRotation: 0, autoSkip: true },
        grid: { color: theme.grid },
      },
      y: {
        stacked,
        beginAtZero: true,
        ticks: { color: theme.muted },
        grid: { color: theme.grid },
      },
    },
    plugins: {
      legend: {
        display: seriesCount <= 20,
        labels: { color: theme.text, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
        filter: seriesCount > 10 ? (item) => item.parsed.y !== 0 : () => true,
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
      type: "line",
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
