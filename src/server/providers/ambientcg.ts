import { unzipSync } from "fflate";
import type { AssetCategory, AssetItem } from "../../core/schema/types";

export const AMBIENT_CG_PROVIDER_ID = "ambientcg";
export const AMBIENT_CG_PROVIDER_NAME = "ambientCG";

const API_BASE_URL = "https://ambientcg.com/api/v2/full_json";
const API_INCLUDE = "downloadData,mapData,previewData";
const PAGE_SIZE = 128;
const LIBRARY_CACHE_TTL_MS = 30 * 60 * 1000;
const ZIP_CACHE_TTL_MS = 10 * 60 * 1000;

const MODEL_FILE_EXTENSIONS = new Set(["usdc", "usd", "usdz", "glb", "gltf", "obj", "fbx"]);
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
  numberOfResults?: number;
};

type AmbientcgLibrary = {
  textures: AssetItem[];
  models: AssetItem[];
};

type LibraryCacheState = {
  expiresAt: number;
  value: AmbientcgLibrary | null;
  promise: Promise<AmbientcgLibrary> | null;
};

type ZipCacheEntry = {
  expiresAt: number;
  data: Uint8Array;
  contentType: string;
  filename: string;
};

const libraryCache: LibraryCacheState = {
  expiresAt: 0,
  value: null,
  promise: null,
};

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

function selectModelDownloads(asset: AmbientcgAsset): Array<{ download: AmbientcgDownload; filename: string }> {
  const folders = asset.downloadFolders?.default?.downloadFiletypeCategories;
  if (!folders) return [];
  const selections: Array<{ download: AmbientcgDownload; filename: string }> = [];
  for (const category of Object.values(folders)) {
    if (!category?.downloads) continue;
    const sorted = [...category.downloads].sort((a, b) => {
      const weight = (value: string | undefined) => {
        if (!value) return Number.POSITIVE_INFINITY;
        const match = value.match(/(\d+)(k|m)/i);
        if (!match) return Number.POSITIVE_INFINITY;
        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        return unit === "m" ? amount * 1000 : amount;
      };
      return weight(a.attribute) - weight(b.attribute);
    });
    for (const download of sorted) {
      const contents = download?.zipContent ?? [];
      for (const file of contents) {
        const ext = file.split(".").pop()?.toLowerCase() ?? "";
        if (!MODEL_FILE_EXTENSIONS.has(ext)) continue;
        selections.push({ download, filename: file });
        break;
      }
      if (selections.length) break;
    }
  }
  return selections;
}

function mapAsset(asset: AmbientcgAsset): AmbientcgLibrary {
  const provider = {
    id: AMBIENT_CG_PROVIDER_ID,
    name: AMBIENT_CG_PROVIDER_NAME,
    assetId: asset.assetId,
    assetUrl: asset.shortLink,
  };
  const previewImage = pickPreviewImage(asset.previewImage);
  const textures: AssetItem[] = [];
  const models: AssetItem[] = [];

  const displayName = asset.displayName || asset.assetId;
  const description = normalizeDescription(asset);

  for (const preview of extractMapPreviews(asset)) {
    const mapLabel = preview.name.trim().replace(/\s+/g, " ");
    const id = `ambientcg:${asset.assetId}:preview:${slugify(mapLabel) || slugify(preview.url)}`;
    textures.push({
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
    textures.push({
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
    textures.push({
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

  for (const selection of selectModelDownloads(asset)) {
    const download = selection.download;
    const link = download.downloadLink || download.fullDownloadPath;
    if (!link) continue;
    const file = selection.filename;
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    const id = `ambientcg:${asset.assetId}:model:${slugify(file)}`;
    const attribute = download.attribute?.replace(/[-_]+/g, " ") || ext.toUpperCase();
    const source = buildAmbientcgFileUrl(link, file);
    models.push({
      id,
      label: `${displayName} • ${attribute}`,
      type: "model",
      source,
      description,
      tags: buildTags(asset, [attribute, ext]),
      builtin: true,
      preview: previewImage,
      provider,
    });
  }

  return { textures, models };
}

function buildAmbientcgFileUrl(downloadLink: string, fileName: string): string {
  const params = new URLSearchParams();
  params.set("download", downloadLink);
  params.set("file", fileName);
  return `/api/assets/ambientcg/file?${params.toString()}`;
}

async function fetchAmbientcgPage(offset: number): Promise<AmbientcgApiResponse> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("include", API_INCLUDE);
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`ambientCG API error: ${res.status}`);
  }
  return (await res.json()) as AmbientcgApiResponse;
}

async function fetchAmbientcgAssets(): Promise<AmbientcgAsset[]> {
  const assets: AmbientcgAsset[] = [];
  let offset = 0;
  let safety = 0;
  const maxPages = 64;
  while (safety < maxPages) {
    safety += 1;
    const page = await fetchAmbientcgPage(offset);
    const found = Array.isArray(page.foundAssets) ? page.foundAssets : [];
    assets.push(...found);
    if (!page.nextPageHttp || found.length === 0) break;
    offset += PAGE_SIZE;
    if (typeof page.numberOfResults === "number" && offset >= page.numberOfResults) break;
  }
  return assets;
}

async function buildAmbientcgLibrary(): Promise<AmbientcgLibrary> {
  const assets = await fetchAmbientcgAssets();
  const textures: AssetItem[] = [];
  const models: AssetItem[] = [];
  for (const asset of assets) {
    if (!asset?.assetId) continue;
    const mapped = mapAsset(asset);
    textures.push(...mapped.textures);
    models.push(...mapped.models);
  }
  return {
    textures,
    models,
  };
}

export async function loadAmbientcgLibrary(): Promise<AmbientcgLibrary> {
  const now = Date.now();
  if (libraryCache.value && libraryCache.expiresAt > now) {
    return libraryCache.value;
  }
  if (libraryCache.promise) {
    return libraryCache.promise;
  }
  const promise = buildAmbientcgLibrary()
    .then((library) => {
      libraryCache.value = library;
      libraryCache.expiresAt = Date.now() + LIBRARY_CACHE_TTL_MS;
      libraryCache.promise = null;
      return library;
    })
    .catch((err) => {
      libraryCache.promise = null;
      throw err;
    });
  libraryCache.promise = promise;
  return promise;
}

export async function loadAmbientcgCategories(): Promise<AssetCategory[]> {
  const library = await loadAmbientcgLibrary();
  const categories: AssetCategory[] = [];
  if (library.textures.length) {
    categories.push({
      id: "ambientcg:textures",
      label: "ambientCG • Textures",
      items: library.textures,
    });
  }
  if (library.models.length) {
    categories.push({
      id: "ambientcg:models",
      label: "ambientCG • Models",
      items: library.models,
    });
  }
  return categories;
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
