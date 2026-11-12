/** Share in-flight font loads. Failed loads are evicted so fallback/retry works. */
export function createFontLoader(load: (font: { family: string; style: string }) => Promise<void>) {
  const cache = new Map<string, Promise<void>>();
  return (font: { family: string; style: string }): Promise<void> => {
    const key = JSON.stringify([font.family, font.style]);
    let pending = cache.get(key);
    if (!pending) {
      pending = Promise.resolve().then(() => load(font)).catch(error => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, pending);
    }
    return pending;
  };
}
