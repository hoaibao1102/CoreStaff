// jsdom has no layout engine; geometry and focus behavior are covered in e2e.
if (typeof window !== 'undefined') {
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (media: string) => ({
      media, matches: false, onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    }),
  });
}
