import VersionConfig from "./version-config";

describe("VersionConfig.parseVersion", () => {
  it("resolves upstream dev builds to the main repository's Dev branch", () => {
    expect(VersionConfig.parseVersion("dev_9.1.29")).toEqual({ owner: "OoTRandomizer", tag: "Dev" });
  });

  it("resolves fork dev builds to the fork's branch head", () => {
    expect(VersionConfig.parseVersion("devrreal_9.0.2-17")).toEqual({ owner: "rrealmuto", tag: "Dev-Rob" });
    expect(VersionConfig.parseVersion("devFenhl_9.1.10-6")).toEqual({ owner: "fenhl", tag: "dev-fenhl" });
    expect(VersionConfig.parseVersion("devFenhl_")).toEqual({ owner: "fenhl", tag: "dev-fenhl" });
  });

  it("maps the first release of a line to upstream's vX.Y tag", () => {
    expect(VersionConfig.parseVersion("9.1.0")).toEqual({ owner: "OoTRandomizer", tag: "v9.1" });
    expect(VersionConfig.parseVersion("9.1.1")).toEqual({ owner: "OoTRandomizer", tag: "9.1.1" });
  });

  it("supports explicit owner/branch syntax", () => {
    expect(VersionConfig.parseVersion("someone/my-branch")).toEqual({ owner: "someone", tag: "my-branch" });
  });
});

describe("VersionConfig.normalizeVersion", () => {
  it("folds a branch name shown on a seed page into the reported version prefix", () => {
    expect(VersionConfig.normalizeVersion("Dev-Rob v9.0.2-17")).toBe("devrreal_9.0.2-17");
    expect(VersionConfig.normalizeVersion("Dev-Fenhl v9.1.10-6")).toBe("devFenhl_9.1.10-6");
    expect(VersionConfig.normalizeVersion("Dev v9.1.29")).toBe("dev_9.1.29");
    expect(VersionConfig.normalizeVersion("Dev-R v8.2.50")).toBe("devR_8.2.50");
  });

  it("accepts a branch name on its own, in any case, with or without the v", () => {
    expect(VersionConfig.normalizeVersion("Dev-Rob")).toBe("devrreal_");
    expect(VersionConfig.normalizeVersion("dev-rob")).toBe("devrreal_");
    expect(VersionConfig.normalizeVersion("DEV-ROB 9.0.2-17")).toBe("devrreal_9.0.2-17");
    expect(VersionConfig.normalizeVersion("  Dev-Rob v9.0.2-17  ")).toBe("devrreal_9.0.2-17");
  });

  it("routes a normalized fork version to that fork's branch", () => {
    expect(VersionConfig.parseVersion(VersionConfig.normalizeVersion("Dev-Rob v9.0.2-17")))
      .toEqual({ owner: "rrealmuto", tag: "Dev-Rob" });
  });

  it("leaves versions the generator already reports untouched", () => {
    for (const version of ["devrreal_9.0.2-17", "devFenhl_9.1.10-6", "dev_9.1.29", "9.1.0", "8.3.0"]) {
      expect(VersionConfig.normalizeVersion(version)).toBe(version);
    }
  });

  it("is idempotent", () => {
    const once = VersionConfig.normalizeVersion("Dev-Rob v9.0.2-17");
    expect(VersionConfig.normalizeVersion(once)).toBe(once);
  });

  it("keeps the existing release handling", () => {
    expect(VersionConfig.normalizeVersion("v9.1")).toBe("9.1.0");
    expect(VersionConfig.normalizeVersion("9.1")).toBe("9.1.0");
    expect(VersionConfig.normalizeVersion("")).toBe(VersionConfig.FALLBACK_VERSION);
  });

  it("keeps upstream Dev distinct from a fork whose branch is also called Dev", () => {
    expect(VersionConfig.normalizeVersion("Dev v9.1.29")).toBe("dev_9.1.29");
    expect(VersionConfig.normalizeVersion("Dev-TFBlitz v9.1.9-115")).toBe("devTFBlitz_9.1.9-115");
    expect(VersionConfig.parseVersion("dev_9.1.29")).toEqual({ owner: "OoTRandomizer", tag: "Dev" });
    expect(VersionConfig.parseVersion("devTFBlitz_9.1.9-115")).toEqual({ owner: "Elagatua", tag: "Dev" });
  });

  it("leaves an unrecognized name alone rather than guessing a branch", () => {
    expect(VersionConfig.normalizeVersion("release")).toBe("release");
    expect(VersionConfig.normalizeVersion("someone/my-branch")).toBe("someone/my-branch");
  });
});
