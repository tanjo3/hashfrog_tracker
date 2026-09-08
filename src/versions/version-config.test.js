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
