import LogicLoader from "./logic-loader";

const MINIMAL_LOGIC = '[{ "region_name": "Root", "locations": { "Links Pocket": "True" } }]';
const MINIMAL_LOCATION_LIST =
  "location_table = OrderedDict([\n" +
  "    (\"Links Pocket\", (\"Event\", None, None, 'Kokiri Sword', (\"Kokiri Forest\",))),\n" +
  "])\n";

/**
 * Serve every GitHub request, recording each URL so a test can assert which ref was used.
 * @param {object} [options] - Test options.
 * @param {Array<string>} [options.missingRefs] - Refs that should answer 404, as if never published.
 * @returns {{fetch: jest.Mock, urls: Array<string>, refsUsed: () => Array<string>}} The mock and its recorded calls.
 */
const mockGithub = ({ missingRefs = [] } = {}) => {
  const urls = [];

  const fetchMock = jest.fn((url, options = {}) => {
    urls.push(`${options.method ?? "GET"} ${url}`);

    if (missingRefs.some(ref => url.includes(`/OoT-Randomizer/${ref}/`))) {
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    }
    if (url.endsWith("Boulders.py")) {
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("") });
    }

    const body = url.endsWith("LocationList.py") ? MINIMAL_LOCATION_LIST : MINIMAL_LOGIC;
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });
  });

  // The distinct refs the logic files themselves were downloaded from.
  const refsUsed = () => [
    ...new Set(
      urls
        .filter(entry => entry.startsWith("GET ") && entry.includes("/OoT-Randomizer/"))
        .map(entry => entry.match(/\/OoT-Randomizer\/(.+?)\/(?:data\/|LocationList|Boulders)/)?.[1])
        .filter(Boolean),
    ),
  ];

  return { fetch: fetchMock, urls, refsUsed };
};

describe("LogicLoader ref resolution", () => {
  let warnSpy;
  let github;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete global.fetch;
  });

  const load = async version => {
    const result = await LogicLoader.loadLogicFiles(version);
    return { ...result, refs: github.refsUsed(), urls: github.urls };
  };

  describe("loads the seed's own build when its repository still publishes it", () => {
    it.each([
      ["dev_9.1.28", "9.1.28"],
      ["devrreal_9.0.2-17", "9.0.2.Rob-17"],
      ["devrreal_9.0.2-6", "9.0.2.Rob-6"],
      ["devFenhl_9.1.10-6", "9.1.10-fenhl.6"],
      ["devEnemyShuffle_9.0.2-23", "9.0.2.Rob-E23"],
    ])("%s loads from %s", async (version, expectedRef) => {
      github = mockGithub();
      global.fetch = github.fetch;

      const { refs, meta } = await load(version);

      expect(refs).toEqual([expectedRef]);
      expect(meta.warnings).toEqual([]);
    });

    it("checks the tag exists with a single HEAD request before downloading anything", async () => {
      github = mockGithub();
      global.fetch = github.fetch;

      const { urls } = await load("devrreal_9.0.2-17");

      const heads = urls.filter(entry => entry.startsWith("HEAD "));
      expect(heads).toHaveLength(1);
      expect(heads[0]).toContain("/9.0.2.Rob-17/data/LogicHelpers.json");
    });
  });

  it("gives two different builds two different sets of logic files", async () => {
    github = mockGithub();
    global.fetch = github.fetch;
    const older = await load("devrreal_9.0.2-6");

    github = mockGithub();
    global.fetch = github.fetch;
    const newer = await load("devrreal_9.0.2-17");

    expect(older.refs).toEqual(["9.0.2.Rob-6"]);
    expect(newer.refs).toEqual(["9.0.2.Rob-17"]);
    expect(older.refs).not.toEqual(newer.refs);
  });

  it("falls back to the branch, with a warning, when the build is no longer published", async () => {
    github = mockGithub({ missingRefs: ["9.1.22"] });
    global.fetch = github.fetch;

    const { refs, meta } = await load("dev_9.1.22");

    expect(refs).toEqual(["Dev"]);
    expect(meta.usedFallback).toBe(false);
    expect(meta.warnings).toHaveLength(1);
    expect(meta.warnings[0]).toMatch(/9\.1\.22 is no longer published/);
    expect(meta.warnings[0]).toMatch(/Dev branch/);
  });

  it("does not claim the build is gone when the check itself failed", async () => {
    github = mockGithub();
    const failingProbe = jest.fn((url, options = {}) => {
      if (options.method === "HEAD") { return Promise.reject(new TypeError("Failed to fetch")); }
      return github.fetch(url, options);
    });
    global.fetch = failingProbe;

    const { meta } = await LogicLoader.loadLogicFiles("devrreal_9.0.2-17");

    expect(github.refsUsed()).toEqual(["Dev-Rob"]);
    expect(meta.warnings).toEqual([]);
  });

  describe("uses the branch directly when a fork publishes no usable build tag", () => {
    it.each([
      ["devTFBlitz_9.1.9-115", "Dev"],
      ["devR_8.1.47-1", "Dev-R"],
    ])("%s loads from %s without probing", async (version, expectedRef) => {
      github = mockGithub();
      global.fetch = github.fetch;

      const { refs, urls, meta } = await load(version);

      expect(refs).toEqual([expectedRef]);
      expect(urls.filter(entry => entry.startsWith("HEAD "))).toHaveLength(0);
      expect(meta.warnings).toEqual([]);
    });
  });

  it("does not probe for releases or for an explicitly named ref", async () => {
    github = mockGithub();
    global.fetch = github.fetch;
    const release = await load("9.1.1");
    expect(release.refs).toEqual(["9.1.1"]);
    expect(release.urls.filter(entry => entry.startsWith("HEAD "))).toHaveLength(0);

    github = mockGithub();
    global.fetch = github.fetch;
    const named = await load("someone/my-branch");
    expect(named.refs).toEqual(["my-branch"]);
    expect(named.urls.filter(entry => entry.startsWith("HEAD "))).toHaveLength(0);
  });
});
