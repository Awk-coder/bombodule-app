import { describe, expect, it, vi } from "vitest";
import {
  checkGitHubUpdate,
  findApkAsset,
  isNewerVersion,
  parseVersion,
} from "./updater";

describe("updater", () => {
  describe("parseVersion", () => {
    it("parses clean semver", () => {
      expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    });

    it("parses prefixed semver", () => {
      expect(parseVersion("v1.2.0")).toEqual([1, 2, 0]);
      expect(parseVersion("release-2.0.1")).toEqual([2, 0, 1]);
    });

    it("handles two digits", () => {
      expect(parseVersion("1.2")).toEqual([1, 2]);
    });
  });

  describe("isNewerVersion", () => {
    it("detects patch increments", () => {
      expect(isNewerVersion("v1.2.3", "1.2.2")).toBe(true);
      expect(isNewerVersion("v1.2.2", "1.2.3")).toBe(false);
      expect(isNewerVersion("v1.2.2", "1.2.2")).toBe(false);
    });

    it("detects minor increments", () => {
      expect(isNewerVersion("v1.3.0", "1.2.9")).toBe(true);
      expect(isNewerVersion("v1.2.9", "1.3.0")).toBe(false);
    });

    it("detects major increments", () => {
      expect(isNewerVersion("v2.0.0", "1.9.9")).toBe(true);
      expect(isNewerVersion("v1.9.9", "2.0.0")).toBe(false);
    });
  });

  describe("findApkAsset", () => {
    it("returns null on empty list", () => {
      expect(findApkAsset([])).toBeNull();
    });

    it("prefers Uni-Ranked.apk", () => {
      const assets = [
        { name: "other.apk", browser_download_url: "https://example.com/other.apk" },
        { name: "Uni-Ranked.apk", browser_download_url: "https://example.com/Uni-Ranked.apk" },
        { name: "source.zip", browser_download_url: "https://example.com/source.zip" },
      ];
      expect(findApkAsset(assets)).toBe("https://example.com/Uni-Ranked.apk");
    });

    it("falls back to any apk if named differently", () => {
      const assets = [
        { name: "source.zip", browser_download_url: "https://example.com/source.zip" },
        { name: "custom-build.apk", browser_download_url: "https://example.com/custom-build.apk" },
      ];
      expect(findApkAsset(assets)).toBe("https://example.com/custom-build.apk");
    });

    it("returns null if no apk exists", () => {
      const assets = [{ name: "source.tar.gz", browser_download_url: "https://example.com/source.tar.gz" }];
      expect(findApkAsset(assets)).toBeNull();
    });
  });

  describe("checkGitHubUpdate", () => {
    it("identifies when update is available", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: "v1.2.4",
          name: "Uni Ranked 1.2.4",
          body: "Release notes here",
          html_url: "https://github.com/Awk-coder/bombodule-app/releases/tag/v1.2.4",
          published_at: "2026-10-12T12:00:00Z",
          assets: [{ name: "Uni-Ranked.apk", browser_download_url: "https://example.com/dl.apk" }],
        }),
      });

      const res = await checkGitHubUpdate("https://api.github.com/mock", "1.2.3", mockFetch as unknown as typeof fetch);
      expect(res).not.toBeNull();
      expect(res?.updateAvailable).toBe(true);
      expect(res?.latestVersion).toBe("v1.2.4");
      expect(res?.apkUrl).toBe("https://example.com/dl.apk");
    });

    it("identifies when app is up to date", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: "v1.2.3",
          name: "Uni Ranked 1.2.3",
          body: "",
          html_url: "",
          published_at: "",
          assets: [{ name: "Uni-Ranked.apk", browser_download_url: "https://example.com/dl.apk" }],
        }),
      });

      const res = await checkGitHubUpdate("https://api.github.com/mock", "1.2.3", mockFetch as unknown as typeof fetch);
      expect(res?.updateAvailable).toBe(false);
    });

    it("handles network failure gracefully", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network offline"));
      const res = await checkGitHubUpdate("https://api.github.com/mock", "1.2.3", mockFetch as unknown as typeof fetch);
      expect(res).toBeNull();
    });
  });
});
