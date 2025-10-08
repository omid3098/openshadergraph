import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { zipSync } from "fflate";

describe("ambientcg provider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps API assets into texture and model entries", async () => {
    const sampleAsset = {
      assetId: "Wood001",
      displayName: "Wood 001",
      dataType: "Material",
      description: "Wood material",
      displayCategory: "Wood",
      tags: ["wood", "pbr"],
      shortLink: "https://ambientcg.com/a/Wood001",
      previewLinks: [
        {
          name: { slug: "pbr-one-material-maps" },
          url: "https://example.com#texture_url=https://assets.example.com/color.jpg,https://assets.example.com/normal.jpg&texture_name=Color,Normal",
        },
      ],
      previewImage: {
        "512-PNG": "https://assets.example.com/preview.png",
      },
      downloadFolders: {
        default: {
          downloadFiletypeCategories: {
            exr: {
              downloads: [
                {
                  downloadLink: "https://ambientcg.com/get?file=Wood001_4K-HDR.exr",
                  filetype: "exr",
                  attribute: "4K-HDR",
                  zipContent: [],
                },
              ],
            },
            zip: {
              downloads: [
                {
                  downloadLink: "https://ambientcg.com/get?file=Wood001_1K-JPG.zip",
                  attribute: "1K-JPG",
                  zipContent: ["Wood001_1K-JPG.usdc", "Wood001_1K-JPG_Color.jpg"],
                },
              ],
            },
          },
        },
      },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch" as any).mockImplementation((...args: unknown[]) => {
      const [url] = args as [string];
      if (url.startsWith("https://ambientcg.com/api/v2/full_json")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ foundAssets: [sampleAsset], nextPageHttp: null }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { queryAmbientcgItems } = await import("../src/server/providers/ambientcg");
    const result = await queryAmbientcgItems();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.some((item) => item.label.includes("Color"))).toBe(true);
    expect(result.items.some((item) => item.source.endsWith(".exr"))).toBe(true);
    expect(result.items.some((item) => item.type === "model")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles catalog handler queries", async () => {
    const sampleAsset = {
      assetId: "Model001",
      displayName: "Model 001",
      dataType: "3DScan",
      downloadFolders: {
        default: {
          downloadFiletypeCategories: {
            zip: {
              downloads: [
                {
                  downloadLink: "https://ambientcg.com/get?file=Model001_1K.zip",
                  attribute: "1K",
                  zipContent: ["Model001_1K.glb"],
                },
              ],
            },
          },
        },
      },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch" as any).mockImplementation((...args: unknown[]) => {
      const [url] = args as [string];
      if (url.startsWith("https://ambientcg.com/api/v2/full_json")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ foundAssets: [sampleAsset], nextPageHttp: null }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { ambientcgCatalogHandler } = await import("../src/server/providers/ambientcg");
    const res = await ambientcgCatalogHandler(
      new Request("http://localhost/api/assets/ambientcg/catalog?type=model")
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.every((item: any) => item.type === "model")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("streams a file from an ambientcg archive", async () => {
    const fileData = new Uint8Array([1, 2, 3, 4]);
    const zipped = zipSync({ "Sample.usdc": fileData });
    const fetchMock = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValue(
        new Response(zipped.slice().buffer, { status: 200, headers: { "content-type": "application/zip" } })
      );

    const { ambientcgFileHandler } = await import("../src/server/providers/ambientcg");
    const req = new Request(
      "http://localhost/api/assets/ambientcg/file?download=https://ambientcg.com/get?file=Wood001_1K-JPG.zip&file=Sample.usdc"
    );
    const res = await ambientcgFileHandler(req);
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    const buffer = new Uint8Array(await res.arrayBuffer());
    expect(buffer).toEqual(fileData);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
