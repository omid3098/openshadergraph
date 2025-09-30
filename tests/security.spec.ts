import { describe, test, expect } from "vitest";
import {
  sanitizeIdentifier,
  isValidPath,
  validateJSON,
  isRateLimited,
} from "../src/server/security";

describe("Security Utilities", () => {
  describe("sanitizeIdentifier", () => {
    test("removes special characters", () => {
      expect(sanitizeIdentifier("hello@world!")).toBe("hello_world_");
    });

    test("handles multiple underscores", () => {
      expect(sanitizeIdentifier("hello___world")).toBe("hello_world");
    });

    test("ensures valid start character", () => {
      expect(sanitizeIdentifier("123abc")).toBe("_123abc");
    });

    test("handles empty string", () => {
      expect(sanitizeIdentifier("")).toBe("unnamed");
    });

    test("prevents injection attempts", () => {
      expect(sanitizeIdentifier("'; DROP TABLE users;--")).toBe("_DROP_TABLE_users_");
    });

    test("handles unicode characters", () => {
      expect(sanitizeIdentifier("hello世界")).toBe("hello_");
    });
  });

  describe("isValidPath", () => {
    test("allows safe relative paths", () => {
      expect(isValidPath("data/nodes/add.json")).toBe(true);
      expect(isValidPath("examples/basic.json")).toBe(true);
    });

    test("rejects directory traversal", () => {
      expect(isValidPath("../../../etc/passwd")).toBe(false);
      expect(isValidPath("data/../../../secret")).toBe(false);
    });

    test("rejects absolute paths", () => {
      expect(isValidPath("/etc/passwd")).toBe(false);
      expect(isValidPath("/var/log/system.log")).toBe(false);
    });

    test("rejects null bytes", () => {
      expect(isValidPath("data\0/nodes")).toBe(false);
    });

    test("handles backslashes", () => {
      expect(isValidPath("data\\..\\secret")).toBe(false);
    });
  });

  describe("validateJSON", () => {
    test("returns valid objects", () => {
      const input = { name: "test", value: 123 };
      const result = validateJSON(input);
      expect(result).toEqual(input);
    });

    test("removes functions", () => {
      const input = {
        name: "test",
        fn: () => "bad",
      };
      const result = validateJSON(input);
      expect(result).toEqual({ name: "test" });
    });

    test("removes undefined values", () => {
      const input = {
        name: "test",
        value: undefined,
      };
      const result = validateJSON(input);
      expect(result).toEqual({ name: "test" });
    });

    test("rejects non-objects", () => {
      expect(validateJSON("string")).toBeNull();
      expect(validateJSON(123)).toBeNull();
      expect(validateJSON(null)).toBeNull();
    });
  });

  describe("isRateLimited", () => {
    test("allows requests under limit", () => {
      const key = "test-user-1";
      expect(isRateLimited(key, 5, 10000)).toBe(false);
      expect(isRateLimited(key, 5, 10000)).toBe(false);
    });

    test("blocks requests over limit", () => {
      const key = "test-user-2";
      
      // Make requests up to limit
      for (let i = 0; i < 5; i++) {
        expect(isRateLimited(key, 5, 10000)).toBe(false);
      }
      
      // Next request should be rate limited
      expect(isRateLimited(key, 5, 10000)).toBe(true);
    });

    test("resets after time window", async () => {
      const key = "test-user-3";
      
      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        isRateLimited(key, 3, 100); // 100ms window
      }
      
      // Should be limited
      expect(isRateLimited(key, 3, 100)).toBe(true);
      
      // Wait for window to reset
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Should be allowed again
      expect(isRateLimited(key, 3, 100)).toBe(false);
    });
  });
});
