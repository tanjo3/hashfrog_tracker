import { isEFK } from "../utils/efk";

const BUNDLED_VERSIONS = new Set(["9.0.0", "8.3.0"]);

// EFK is handled separately from BUNDLED_VERSIONS and relies instead on isEFK().
const EFK_BUNDLE = "EFK";

const DEFAULT_OWNER = "OoTRandomizer";
const FALLBACK_VERSION = "9.0.0";

// Maps dev-branch version prefixes to the repository branch that hosts the matching logic files.
const DEV_FORK_BRANCHES = {
  dev_: { owner: DEFAULT_OWNER, tag: "Dev" },
  devrreal_: { owner: "rrealmuto", tag: "Dev-Rob" },
  devFenhl_: { owner: "fenhl", tag: "dev-fenhl" },
  devR_: { owner: "Roman971", tag: "Dev-R" },
  devEnemyShuffle_: { owner: "rrealmuto", tag: "enemy_shuffle" },
};

// The generator's seed pages name a dev build by its branch, but both the settings service and the
// logic files areaddressed by the prefix that the generator itself reports.
// That prefix appears nowhere on the page, so accept the displayed name too.
// Keyed by branch name so it cannot drift from the branch list above.
const BRANCH_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(DEV_FORK_BRANCHES).map(([prefix, fork]) => [fork.tag.toLowerCase(), prefix]),
);

// A branch name on its own, or followed by the build it produced: "Dev-Rob", "Dev-Rob v9.0.2-17", "Dev 9.1.29".
const DISPLAYED_BRANCH = /^([A-Za-z][A-Za-z0-9_-]*)(?:\s+v?(\S+))?$/;

/**
 * Checks if a version has bundled logic files.
 * @param {string} version - The version string to check.
 * @param {string} [settingsString] - The settings string, used to detect the EFK bundle.
 * @returns {boolean} True if the version is bundled.
 */
function isBundled(version, settingsString) {
  return isEFK(settingsString) || BUNDLED_VERSIONS.has(version);
}

/**
 * Dynamically imports bundled logic files for a version.
 * @param {string} version - The version string.
 * @param {string} [settingsString] - The settings string, used to detect the EFK bundle.
 * @returns {Promise<object|null>} The bundle or null if not bundled.
 */
async function getBundledLogicFiles(version, settingsString) {
  if (!isBundled(version, settingsString)) {
    return null;
  }

  const bundleName = isEFK(settingsString) ? EFK_BUNDLE : version;
  const bundle = await import(`./bundles/${bundleName}/index.js`);
  return bundle.default;
}

/**
 * Parses a version string into owner and tag, supporting fork syntax.
 * @param {string} version - The version string (e.g. "9.0.0" or "owner/tag").
 * @returns {{owner: string, tag: string}} The parsed owner and tag.
 */
function parseVersion(version) {
  if (!version) {
    return { owner: DEFAULT_OWNER, tag: FALLBACK_VERSION };
  }

  // Fork syntax: owner/tag
  if (version.includes("/")) {
    const [owner, ...tagParts] = version.split("/");
    return { owner, tag: tagParts.join("/") };
  }

  // Known dev fork versions
  for (const [prefix, fork] of Object.entries(DEV_FORK_BRANCHES)) {
    if (version.startsWith(prefix)) {
      return { owner: fork.owner, tag: fork.tag };
    }
  }

  // Upstream tags the first release of a minor line as "vX.Y"
  // normalizeVersion pads a bare "9.1" out to "9.1.0", and the generator reports that same dotted form, so translate it back.
  const firstReleaseOfLine = version.match(/^(\d+)\.(\d+)\.0$/);
  if (firstReleaseOfLine) {
    return { owner: DEFAULT_OWNER, tag: `v${firstReleaseOfLine[1]}.${firstReleaseOfLine[2]}` };
  }

  // Main repo
  return { owner: DEFAULT_OWNER, tag: version };
}

/**
 * Returns the fallback version string.
 * @returns {string} The fallback version.
 */
function getFallbackVersion() {
  return FALLBACK_VERSION;
}

/**
 * Loads bundled logic files for the fallback version.
 * @returns {Promise<object>} The fallback bundle.
 */
async function getFallbackLogicFiles() {
  return getBundledLogicFiles(FALLBACK_VERSION);
}

/**
 * Normalizes a version string into the form the generator itself reports.
 *
 * Folds a branch name as a seed page displays it into its version prefix, strips a leading "v", and
 * pads a bare major.minor out to a patch version.
 * Already-normalized versions pass through unchanged.
 * @param {string} version - The raw version string, as typed or as saved.
 * @returns {string} The normalized version.
 */
function normalizeVersion(version) {
  if (!version) {
    return FALLBACK_VERSION;
  }

  const trimmed = version.trim();

  // A branch name as the seed page shows it
  const displayedBranch = trimmed.match(DISPLAYED_BRANCH);
  const branchPrefix = displayedBranch && BRANCH_DISPLAY_NAMES[displayedBranch[1].toLowerCase()];
  if (branchPrefix) {
    return `${branchPrefix}${displayedBranch[2] ?? ""}`;
  }

  // Dev versions pass through unchanged
  if (trimmed.startsWith("dev")) {
    return trimmed;
  }

  // Remove leading "v" if present
  let normalized = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;

  // Add .0 patch version if only major.minor provided
  const parts = normalized.split(".");
  if (parts.length === 2) {
    normalized = `${normalized}.0`;
  }

  return normalized;
}

const VersionConfig = {
  DEFAULT_OWNER,
  FALLBACK_VERSION,
  isBundled,
  getBundledLogicFiles,
  parseVersion,
  getFallbackVersion,
  getFallbackLogicFiles,
  normalizeVersion,
};

export default VersionConfig;
