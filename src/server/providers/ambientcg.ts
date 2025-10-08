import { unzipSync } from "fflate";
import type { AssetItem } from "../../core/schema/types";

export const AMBIENT_CG_PROVIDER_ID = "ambientcg";
export const AMBIENT_CG_PROVIDER_NAME = "ambientCG";

const API_BASE_URL = "https://ambientcg.com/api/v2/full_json";
const API_INCLUDE = "downloadData,previewData";
const PAGE_SIZE = 96;
const PAGE_CACHE_TTL_MS = 30 * 60 * 1000;
const ZIP_CACHE_TTL_MS = 10 * 60 * 1000;

const DIRECT_FILE_EXTENSIONS = new Set(["exr", "hdr", "png", "jpg", "jpeg", "webp", "tif", "tiff"]);

const MIME_BY_EXTENSION: Record<string, string> = {
  exr: "image/exr",
  hdr: "image/vnd.radiance",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  usdc: "application/octet-stream",
  usd: "application/octet-stream",
  usdz: "model/vnd.usdz+zip",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  obj: "text/plain",
  fbx: "application/octet-stream",
};

type AmbientcgPreviewLink = {
  url?: string;
  name?: {
    slug?: string;
    title?: string;
  } | null;
};

type AmbientcgDownload = {
  downloadLink?: string;
  fullDownloadPath?: string;
  fileName?: string;
  filetype?: string;
  attribute?: string;
  zipContent?: string[];
};

type AmbientcgAsset = {
  assetId: string;
  displayName?: string;
  dataType?: string;
  description?: string;
  displayCategory?: string;
  tags?: string[];
  shortLink?: string;
  previewLinks?: AmbientcgPreviewLink[];
  previewImage?: Record<string, string>;
  downloadFolders?: {
    default?: {
      downloadFiletypeCategories?: Record<string, { downloads?: AmbientcgDownload[] }>;
    };
  };
};

type AmbientcgApiResponse = {
  foundAssets?: AmbientcgAsset[];
  nextPageHttp?: string | null;
};

type AmbientcgPageCacheEntry = {
  expiresAt: number;
  assets: AmbientcgAsset[];
  nextOffset: number | null;
};

type ZipCacheEntry = {
  expiresAt: number;
  data: Uint8Array;
  contentType: string;
  filename: string;
};

const pageCache = new Map<string, AmbientcgPageCacheEntry>();
const zipCache = new Map<string, ZipCacheEntry>();

function slugify(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function pickPreviewImage(previewImage?: Record<string, string>): string | undefined {
  if (!previewImage) return undefined;
  const preferredOrder = [
    "1024-PNG",
    "1024-JPG-242424",
    "512-PNG",
    "512-JPG-242424",
    "256-PNG",
    "256-JPG-242424",
  ];
  for (const key of preferredOrder) {
    if (previewImage[key]) return previewImage[key];
  }
  const first = Object.values(previewImage)[0];
  return typeof first === "string" ? first : undefined;
}

function normalizeDescription(asset: AmbientcgAsset): string {
  return asset.description || asset.displayCategory || "";
}

function buildTags(asset: AmbientcgAsset, extra?: string[]): string[] {
  const tags: string[] = [];
  if (asset.dataType) tags.push(asset.dataType.toLowerCase());
  if (Array.isArray(asset.tags)) {
    for (const tag of asset.tags) {
      if (typeof tag === "string" && tag.trim()) tags.push(tag.trim().toLowerCase());
    }
  }
  for (const item of extra ?? []) {
    if (item && item.trim()) tags.push(item.trim().toLowerCase());
  }
  tags.push(AMBIENT_CG_PROVIDER_ID);
  return Array.from(new Set(tags));
}

function parsePreviewList(link: string | undefined): string[] {
  if (!link) return [];
  const hashIndex = link.indexOf("#");
  if (hashIndex === -1) return [];
  const fragment = link.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  const raw = params.get("texture_url") ?? params.get("environment_url");
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePreviewNames(link: string | undefined): string[] {
  if (!link) return [];
  const hashIndex = link.indexOf("#");
  if (hashIndex === -1) return [];
  const fragment = link.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  const raw = params.get("texture_name") ?? params.get("environment_name");
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function extractMapPreviews(asset: AmbientcgAsset): Array<{ name: string; url: string }> {
  const previews: Array<{ name: string; url: string }> = [];
  const entries = asset.previewLinks ?? [];
  for (const entry of entries) {
    const slug = entry?.name?.slug ?? entry?.name?.title ?? "";
    if (!slug) continue;
    const normalizedSlug = slug.toLowerCase();
    if (!normalizedSlug.includes("material") && !normalizedSlug.includes("texture")) continue;
    const urls = parsePreviewList(entry.url);
    const names = parsePreviewNames(entry.url);
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      if (!url) continue;
      const name = names[index] ?? `Map ${index + 1}`;
      previews.push({ name, url });
    }
    if (previews.length) break;
  }
  return previews;
}

function extractHdriPreviews(asset: AmbientcgAsset): Array<{ name: string; url: string }> {
  const previews: Array<{ name: string; url: string }> = [];
  const entries = asset.previewLinks ?? [];
  for (const entry of entries) {
    const slug = entry?.name?.slug ?? entry?.name?.title ?? "";
    if (!slug) continue;
    const normalizedSlug = slug.toLowerCase();
    if (!normalizedSlug.includes("panorama")) continue;
    const urls = parsePreviewList(entry.url);
    const names = parsePreviewNames(entry.url);
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      if (!url) continue;
      const name = names[index] ?? `Preview ${index + 1}`;
      previews.push({ name, url });
    }
    if (previews.length) break;
  }
  return previews;
}

function extractDirectDownloads(asset: AmbientcgAsset): AmbientcgDownload[] {
  const folders = asset.downloadFolders?.default?.downloadFiletypeCategories;
  if (!folders) return [];
  const downloads: AmbientcgDownload[] = [];
  for (const category of Object.values(folders)) {
    if (!category?.downloads) continue;
    for (const download of category.downloads) {
      const ext = (download?.filetype ?? "").toLowerCase();
      const hasZip = Array.isArray(download?.zipContent) && download!.zipContent!.length > 0;
      if (hasZip) continue;
      if (!DIRECT_FILE_EXTENSIONS.has(ext)) continue;
      downloads.push(download);
    }
  }
  return downloads;
}

type AmbientcgItemType = "all" | "texture" | "model";

function mapAmbientcgAsset(asset: AmbientcgAsset, filter: AmbientcgItemType): AssetItem[] {
  const provider = {
    id: AMBIENT_CG_PROVIDER_ID,
    name: AMBIENT_CG_PROVIDER_NAME,
    assetId: asset.assetId,
    assetUrl: asset.shortLink,
  } as const;
  const previewImage = pickPreviewImage(asset.previewImage);
  const items: AssetItem[] = [];
  if (filter === "model") {
    return items;
  }
  const allowTextures = filter === "all" || filter === "texture";

  const displayName = asset.displayName || asset.assetId;
  const description = normalizeDescription(asset);

  if (allowTextures) {
    for (const preview of extractMapPreviews(asset)) {
      const mapLabel = preview.name.trim().replace(/\s+/g, " ");
      const id = `ambientcg:${asset.assetId}:preview:${slugify(mapLabel) || slugify(preview.url)}`;
      items.push({
        id,
        label: `${displayName} • ${mapLabel}`,
        type: "texture",
        source: preview.url,
        description,
        tags: buildTags(asset, [mapLabel, "preview"]),
        builtin: true,
        preview: preview.url,
        provider,
      });
    }

    for (const hdri of extractHdriPreviews(asset)) {
      const name = hdri.name || "Preview";
      const id = `ambientcg:${asset.assetId}:hdri:${slugify(name)}:${slugify(hdri.url)}`;
      items.push({
        id,
        label: `${displayName} • ${name}`,
        type: "texture",
        source: hdri.url,
        description,
        tags: buildTags(asset, [name, "preview"]),
        builtin: true,
        preview: previewImage ?? hdri.url,
        provider,
      });
    }

    for (const download of extractDirectDownloads(asset)) {
      const link = download.downloadLink || download.fullDownloadPath;
      if (!link) continue;
      const attribute = download.attribute || download.fileName || download.filetype || "Variant";
      const labelAttribute = attribute.replace(/[-_]+/g, " ");
      const id = `ambientcg:${asset.assetId}:direct:${slugify(attribute)}:${slugify(link)}`;
      items.push({
        id,
        label: `${displayName} • ${labelAttribute}`,
        type: "texture",
        source: link,
        description,
        tags: buildTags(asset, [attribute, download.filetype ?? ""]),
        builtin: true,
        preview: previewImage,
        provider,
      });
    }
  }

  return items;
}

function parseOffsetFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const offsetParam = parsed.searchParams.get("offset");
    if (!offsetParam) return null;
    const offset = Number(offsetParam);
    return Number.isFinite(offset) ? offset : null;
  } catch (_err) {
    return null;
  }
}

function makePageCacheKey(query: string, offset: number): string {
  return `${query.toLowerCase()}::${offset}`;
}

async function fetchAmbientcgPageRaw(query: string, offset: number): Promise<AmbientcgApiResponse> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(Math.max(0, offset)));
  url.searchParams.set("include", API_INCLUDE);
  if (query) {
    url.searchParams.set("q", query);
  }
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`ambientCG API error: ${res.status}`);
  }
  return (await res.json()) as AmbientcgApiResponse;
}

async function loadAmbientcgPage(query: string, offset: number): Promise<AmbientcgPageCacheEntry> {
  const key = makePageCacheKey(query, offset);
  const now = Date.now();
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  const response = await fetchAmbientcgPageRaw(query, offset);
  const assets = Array.isArray(response.foundAssets) ? response.foundAssets : [];
  const nextOffset = parseOffsetFromUrl(response.nextPageHttp);
  const entry: AmbientcgPageCacheEntry = {
    assets,
    nextOffset,
    expiresAt: now + PAGE_CACHE_TTL_MS,
  };
  pageCache.set(key, entry);
  return entry;
}

function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const value = Number(cursor);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function encodeCursor(offset: number | null): string | null {
  if (offset === null || !Number.isFinite(offset) || offset < 0) return null;
  return String(Math.floor(offset));
}

export type AmbientcgCatalogQuery = {
  cursor?: string | null;
  query?: string;
  type?: "texture" | "model" | "all";
};

export type AmbientcgCatalogResult = {
  items: AssetItem[];
  cursor: string | null;
};

export async function queryAmbientcgItems(options: AmbientcgCatalogQuery = {}): Promise<AmbientcgCatalogResult> {
  const query = (options.query ?? "").trim();
  const filter: AmbientcgItemType = options.type === "texture" || options.type === "model" ? options.type : "all";
  if (filter === "model") {
    return { items: [], cursor: null };
  }
  let offset = parseCursor(options.cursor);
  let page = await loadAmbientcgPage(query, offset);
  let nextOffset = page.nextOffset;

  const items: AssetItem[] = [];
  const maxPages = filter === "all" ? 1 : 4;
  const minResults = filter === "texture" ? 24 : 0;
  let processed = 0;

  while (true) {
    processed += 1;
    for (const asset of page.assets) {
      if (!asset?.assetId) continue;
      items.push(...mapAmbientcgAsset(asset, filter));
    }

    if (filter === "all") break;
    if (items.length >= minResults) break;
    if (nextOffset === null) break;
    if (processed >= maxPages) break;

    offset = nextOffset;
    page = await loadAmbientcgPage(query, offset);
    nextOffset = page.nextOffset;
  }

  return {
    items,
    cursor: encodeCursor(nextOffset),
  };
}

export async function ambientcgCatalogHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const query = url.searchParams.get("query") ?? "";
    const typeParam = (url.searchParams.get("type") ?? "").toLowerCase();
    const type = typeParam === "texture" || typeParam === "model" ? typeParam : typeParam === "all" ? "all" : undefined;
    const result = await queryAmbientcgItems({ cursor, query, type });
    return Response.json(result);
  } catch (err) {
    console.error("[ambientcg] catalog handler failed", err);
    return Response.json({ error: "Failed to load ambientCG assets" }, { status: 500 });
  }
}

export async function ambientcgFileHandler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const download = url.searchParams.get("download");
    const file = url.searchParams.get("file");
    if (!download || !file) {
      return Response.json({ error: "Missing 'download' or 'file' parameters" }, { status: 400 });
    }
    const cacheKey = `${download}::${file}`;
    const now = Date.now();
    const cached = zipCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      const payload = cached.data.slice().buffer;
      return new Response(payload, {
        headers: {
          "content-type": cached.contentType,
          "cache-control": "public, max-age=300",
          "x-ambientcg-filename": cached.filename,
        },
      });
    }
    const res = await fetch(download, { headers: { accept: "application/zip" } });
    if (!res.ok) {
      return Response.json({ error: `Failed to fetch ambientCG archive: ${res.status}` }, { status: 502 });
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const zipEntries = unzipSync(buffer);
    const entryName = Object.keys(zipEntries).find((name) => name.toLowerCase() === file.toLowerCase());
    if (!entryName) {
      return Response.json({ error: `File '${file}' not found in archive` }, { status: 404 });
    }
    const data = zipEntries[entryName];
    const ext = entryName.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
    const expiresAt = Date.now() + ZIP_CACHE_TTL_MS;
    zipCache.set(cacheKey, { data, contentType, expiresAt, filename: entryName });
    const payload = data.slice().buffer;
    return new Response(payload, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=300",
        "x-ambientcg-filename": entryName,
      },
    });
  } catch (err) {
    console.error("[ambientcg] file handler failed", err);
    return Response.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
