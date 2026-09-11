/**
 * The `x-view` directive: fetch a view's HTML, cache it, and inject it into the
 * element whenever the bound expression changes. Alpine's mutation observer
 * initialises the injected markup; `nextTick` keeps the injection outside
 * Alpine's own mutation phase.
 */

/** @type {Map<string, Promise<string>>} */
const cache = new Map();

/**
 * Fetch a view's HTML by name, cached for the lifetime of the page.
 * @param {string} name - The view name, resolved to `views/<name>.html`.
 * @returns {Promise<string>} The view's markup.
 */
export function loadView(name) {
  let html = cache.get(name);
  if (html === undefined) {
    html = fetch(`views/${name}.html`).then((response) => {
      if (!response.ok) throw new Error(`Failed to load view "${name}": ${response.status}`);
      return response.text();
    });
    cache.set(name, html);
  }
  return html;
}

/**
 * Register the `x-view` directive on an Alpine instance.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @returns {void}
 */
export function registerViewDirective(Alpine) {
  Alpine.directive("view", (el, { expression }, { effect, evaluateLater }) => {
    const getName = evaluateLater(expression);
    effect(() =>
      getName(async (name) => {
        const html = await loadView(String(name));
        Alpine.nextTick(() => {
          el.innerHTML = html;
        });
      }),
    );
  });
}
