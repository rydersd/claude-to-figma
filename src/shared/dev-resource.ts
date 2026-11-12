// L2F_DEV_MODE helpers shared by the plugin and the server, so both apply the same
// link rule. Pure string work: the plugin sandbox has no URL (see wiki/concepts/dev-mode.md).

export const MAX_URL_LENGTH = 2048;
// Text that comes from the Figma file (names, links, measurement text) is cut to this
// length in tool output.
export const MAX_UNTRUSTED_TEXT = 200;

// A DNS label: letters, digits and inner hyphens, never empty.
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?";
// 1 to 65535, no leading zeros.
const PORT = "(?:6553[0-5]|655[0-2]\\d|65[0-4]\\d{2}|6[0-4]\\d{3}|[1-5]\\d{4}|[1-9]\\d{0,3})";
// https, a host of non-empty labels, an optional port, then a path, query or fragment of
// printable ASCII without backslash (! to [ and ] to ~): no spaces, controls or
// non-ASCII characters, and no credentials (the host ends at the first character that
// is not part of a label).
export const HTTPS_URL = new RegExp(`^https://${LABEL}(?:\\.${LABEL})*(?::${PORT})?(?:[/?#][!-\\[\\]-~]*)?$`, "i");

export function matchesHttpsUrl(url: unknown): url is string {
  return typeof url === "string" && url.length <= MAX_URL_LENGTH && HTTPS_URL.test(url);
}

// The form two links are compared in: scheme and host lowercased, and a trailing
// slash on the path ignored. A string without scheme://host is compared as it is.
export function urlKey(url: string): string {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*)([^?#]*)(.*)$/.exec(url);
  if (!match) return url;
  return match[1].toLowerCase() + match[2].replace(/\/$/, "") + match[3];
}

export function sameUrl(a: string, b: string): boolean {
  return urlKey(a) === urlKey(b);
}

export function capText(value: unknown): unknown {
  if (typeof value !== "string" || value.length <= MAX_UNTRUSTED_TEXT) return value;
  return value.slice(0, MAX_UNTRUSTED_TEXT - 1) + "…";
}
