/**
 * A plugin's own text in the interface language.
 *
 * A plugin writes its manifest in one language and may add `i18n`: per
 * language code, a map from that text to the text in the language -- the same
 * way the console's own catalogs work. Text with no entry is shown as written.
 * Its page gets the language as `?lang=` and translates itself.
 */

export type PluginCatalogs = Record<string, Record<string, string>>;

/** The catalog for a language: an exact code first ("zh-CN"), then its family ("zh"). */
export function pluginCatalog(i18n: PluginCatalogs | null | undefined, locale: string): Record<string, string> {
  if (!i18n) return {};
  const family = locale.split("-")[0];
  return i18n[locale] ?? i18n[family] ?? {};
}

/** A function from the manifest's text to the text in `locale`. */
export function pluginWords(i18n: PluginCatalogs | null | undefined, locale: string): (text: string) => string {
  const catalog = pluginCatalog(i18n, locale);
  return (text) => (typeof catalog[text] === "string" && catalog[text] ? catalog[text] : text);
}

/** The plugin's page, told which language to use. */
export function pageInLanguage(url: string | null, locale: string): string | null {
  if (!url) return url;
  const [base, hash = ""] = url.split("#", 2);
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}lang=${encodeURIComponent(locale)}${hash ? `#${hash}` : ""}`;
}
