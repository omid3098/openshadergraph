export function extractNodeAliases(meta: unknown): string[] {
  if (!Array.isArray(meta)) return [];

  const aliases = new Set<string>();

  for (const entry of meta) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const prefix = "alias:";
      if (trimmed.toLowerCase().startsWith(prefix)) {
        const alias = trimmed.slice(prefix.length).trim();
        if (alias) aliases.add(alias);
      }
      continue;
    }

    if (!entry || typeof entry !== "object") continue;

    const container = entry as Record<string, unknown>;
    const rawList =
      container.aliases ??
      container.alias ??
      container.search_aliases ??
      container.searchAliases ??
      container.search_terms ??
      container.searchTerms;

    const values = Array.isArray(rawList)
      ? rawList
      : typeof rawList === "string"
        ? [rawList]
        : [];

    for (const value of values) {
      if (typeof value !== "string") continue;
      const alias = value.trim();
      if (alias) aliases.add(alias);
    }
  }

  return Array.from(aliases);
}
