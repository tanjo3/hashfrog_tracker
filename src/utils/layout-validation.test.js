import { isValidLayout } from "./layout-validation";

import baseLayout from "../layouts/base.json";
import escapefromkakLayout from "../layouts/escapefromkak.json";
import hashfrogLayout from "../layouts/hashfrog.json";
import hashfrogMentorLayout from "../layouts/HashFrogMentor.json";
import hashfrogSawsLayout from "../layouts/HashFrogSAWS.json";
import linsoLayout from "../layouts/linso.json";

describe("isValidLayout", () => {
  it("accepts every bundled layout", () => {
    [baseLayout, hashfrogLayout, hashfrogMentorLayout, hashfrogSawsLayout, linsoLayout, escapefromkakLayout].forEach(
      layout => {
        expect(isValidLayout(layout)).toBe(true);
      },
    );
  });

  it("accepts a minimal valid layout", () => {
    expect(isValidLayout({ layoutConfig: { width: 100, height: 200 }, components: [] })).toBe(true);
  });

  it("rejects null and undefined", () => {
    expect(isValidLayout(null)).toBe(false);
    expect(isValidLayout(undefined)).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isValidLayout("layout")).toBe(false);
    expect(isValidLayout(42)).toBe(false);
    expect(isValidLayout([])).toBe(false);
  });

  it("rejects a layout without layoutConfig", () => {
    expect(isValidLayout({ components: [] })).toBe(false);
  });

  it("rejects a layout whose layoutConfig is not an object", () => {
    expect(isValidLayout({ layoutConfig: "config", components: [] })).toBe(false);
    expect(isValidLayout({ layoutConfig: [100, 200], components: [] })).toBe(false);
  });

  it("rejects a layout with non-numeric dimensions", () => {
    expect(isValidLayout({ layoutConfig: { width: "100", height: 200 }, components: [] })).toBe(false);
    expect(isValidLayout({ layoutConfig: { width: 100 }, components: [] })).toBe(false);
    expect(isValidLayout({ layoutConfig: { width: NaN, height: 200 }, components: [] })).toBe(false);
  });

  it("rejects a layout without a components array", () => {
    expect(isValidLayout({ layoutConfig: { width: 100, height: 200 } })).toBe(false);
    expect(isValidLayout({ layoutConfig: { width: 100, height: 200 }, components: {} })).toBe(false);
  });
});
