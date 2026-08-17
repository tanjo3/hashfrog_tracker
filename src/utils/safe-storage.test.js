import { readJSON, removeKeys, writeJSON, writeString } from "./safe-storage";

describe("safe-storage", () => {
  let warnSpy;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  describe("readJSON", () => {
    it("parses a stored JSON value", () => {
      localStorage.setItem("key", JSON.stringify({ a: 1 }));
      expect(readJSON("key")).toEqual({ a: 1 });
    });

    it("returns the fallback when the key is absent", () => {
      expect(readJSON("missing", "fallback")).toBe("fallback");
    });

    it("returns null by default when the key is absent", () => {
      expect(readJSON("missing")).toBeNull();
    });

    it("returns the fallback and warns on corrupt JSON", () => {
      localStorage.setItem("key", "{corrupt");
      expect(readJSON("key", "fallback")).toBe("fallback");
      expect(warnSpy).toHaveBeenCalled();
    });

    it("returns the fallback when localStorage.getItem throws", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage unavailable");
      });
      expect(readJSON("key", "fallback")).toBe("fallback");
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("writeJSON", () => {
    it("serializes and stores the value", () => {
      expect(writeJSON("key", { a: 1 })).toBe(true);
      expect(localStorage.getItem("key")).toBe(JSON.stringify({ a: 1 }));
    });

    it("returns false and warns when the write throws", () => {
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      expect(writeJSON("key", { a: 1 })).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("writeString", () => {
    it("stores the raw string", () => {
      expect(writeString("key", "value")).toBe(true);
      expect(localStorage.getItem("key")).toBe("value");
    });

    it("returns false and warns when the write throws", () => {
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      expect(writeString("key", "value")).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("removeKeys", () => {
    it("removes all listed keys", () => {
      localStorage.setItem("a", "1");
      localStorage.setItem("b", "2");
      localStorage.setItem("c", "3");
      removeKeys("a", "b");
      expect(localStorage.getItem("a")).toBeNull();
      expect(localStorage.getItem("b")).toBeNull();
      expect(localStorage.getItem("c")).toBe("3");
    });

    it("keeps removing after an individual failure", () => {
      localStorage.setItem("b", "2");
      const original = Storage.prototype.removeItem;
      jest.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key) {
        if (key === "a") {
          throw new Error("boom");
        }
        return original.call(this, key);
      });
      removeKeys("a", "b");
      expect(localStorage.getItem("b")).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
