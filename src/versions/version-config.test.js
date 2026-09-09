import VersionConfig from "./version-config";

describe("VersionConfig.parseVersion", () => {
  it("resolves upstream dev builds to the Dev branch, and to that build's own tag", () => {
    expect(VersionConfig.parseVersion("dev_9.1.29"))
      .toEqual({ owner: "OoTRandomizer", tag: "Dev", exactTag: "9.1.29" });
  });

  it("derives each fork's own tag format for the exact build", () => {
    expect(VersionConfig.parseVersion("devrreal_9.0.2-17"))
      .toEqual({ owner: "rrealmuto", tag: "Dev-Rob", exactTag: "9.0.2.Rob-17" });
    expect(VersionConfig.parseVersion("devFenhl_9.1.10-6"))
      .toEqual({ owner: "fenhl", tag: "dev-fenhl", exactTag: "9.1.10-fenhl.6" });
    expect(VersionConfig.parseVersion("devEnemyShuffle_9.0.2-23"))
      .toEqual({ owner: "rrealmuto", tag: "enemy_shuffle", exactTag: "9.0.2.Rob-E23" });
  });

  it("has no exact tag when the build is unknown or the fork publishes none", () => {
    // A bare prefix names no build at all
    expect(VersionConfig.parseVersion("devFenhl_"))
      .toEqual({ owner: "fenhl", tag: "dev-fenhl", exactTag: null });

    // Dev-R publishes no tags for the builds it reports
    expect(VersionConfig.parseVersion("devR_8.1.47-1"))
      .toEqual({ owner: "Roman971", tag: "Dev-R", exactTag: null });

    // Elagatua's tag names do not follow from the build number, so none can be derived
    expect(VersionConfig.parseVersion("devTFBlitz_9.1.9-115"))
      .toEqual({ owner: "Elagatua", tag: "Dev", exactTag: null });
  });

  it("maps the first release of a line to upstream's vX.Y tag", () => {
    expect(VersionConfig.parseVersion("9.1.0")).toEqual({ owner: "OoTRandomizer", tag: "v9.1", exactTag: null });
    expect(VersionConfig.parseVersion("9.1.1")).toEqual({ owner: "OoTRandomizer", tag: "9.1.1", exactTag: null });
  });

  it("supports explicit owner/branch syntax", () => {
    expect(VersionConfig.parseVersion("someone/my-branch"))
      .toEqual({ owner: "someone", tag: "my-branch", exactTag: null });
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

  it("routes a name off a seed page all the way to that build's own tag", () => {
    expect(VersionConfig.parseVersion(VersionConfig.normalizeVersion("Dev-Rob v9.0.2-17")))
      .toEqual({ owner: "rrealmuto", tag: "Dev-Rob", exactTag: "9.0.2.Rob-17" });
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
    expect(VersionConfig.parseVersion("dev_9.1.29"))
      .toEqual({ owner: "OoTRandomizer", tag: "Dev", exactTag: "9.1.29" });
    expect(VersionConfig.parseVersion("devTFBlitz_9.1.9-115"))
      .toEqual({ owner: "Elagatua", tag: "Dev", exactTag: null });
  });

  it("leaves an unrecognized name alone rather than guessing a branch", () => {
    expect(VersionConfig.normalizeVersion("release")).toBe("release");
    expect(VersionConfig.normalizeVersion("someone/my-branch")).toBe("someone/my-branch");
  });
});
