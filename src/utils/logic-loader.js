import DUNGEONS from "../data/dungeons.json";
import VersionConfig from "../versions/version-config";

import { parseBoulderTable } from "./boulder-table-parser.mjs";
import { isEFK } from "./efk";
import { parseLocationTable } from "./location-table-parser.mjs";

class LogicLoader {
  /**
   * Load the logic files for a generator version, preferring a bundled copy and otherwise fetching from GitHub.
   * @param {string} version - Generator version as reported by the randomizer (e.g. "9.1.0" or "owner/tag").
   * @param {string} [settingsString] - Settings string, used to detect the EFK bundle.
   * @param {object} [options] - Loading options.
   * @param {AbortSignal} [options.signal] - Cancels the GitHub downloads (a timeout or an unmount).
   *   The loader then falls back to the bundled version like any other download failure.
   * @returns {Promise<{files: object, meta: {requestedVersion: string, resolvedVersion: string, source: string, usedFallback: boolean, reason: string|null, warnings: string[]}}>}
   *   The logic bundle plus a description of where it came from. `source` is "bundled", "fetched" or "fallback".
   */
  static async loadLogicFiles(version, settingsString, { signal } = {}) {
    const normalizedVersion = VersionConfig.normalizeVersion(version);

    // Check for bundled logic files
    if (VersionConfig.isBundled(normalizedVersion, settingsString)) {
      const files = await VersionConfig.getBundledLogicFiles(normalizedVersion, settingsString);
      const resolvedVersion = isEFK(settingsString) ? "EFK" : normalizedVersion;
      return {
        files,
        meta: this._meta(normalizedVersion, resolvedVersion, "bundled"),
      };
    }

    // If none are found, try to fetch them from GitHub
    const { owner, tag } = VersionConfig.parseVersion(normalizedVersion);

    try {
      const { files, warnings } = await this._fetchLogicFiles(owner, tag, signal);
      return {
        files,
        meta: this._meta(normalizedVersion, normalizedVersion, "fetched", { warnings }),
      };
    } catch (error) {
      // If unable to fetch logic files, fall back to the bundled version
      const fallbackVersion = VersionConfig.getFallbackVersion();
      const reason = this._describeError(error);
      console.warn(
        `Failed to fetch logic files for ${owner}/${tag} (version "${version}"): ${reason}. ` +
        `Falling back to bundled ${fallbackVersion} logic files. ` +
        `Tooltips and logic may be inaccurate.`,
      );

      let files;
      try {
        files = await VersionConfig.getFallbackLogicFiles();
      } catch (fallbackError) {
        // Offline with the fallback chunk not yet cached, most likely.
        // Keep the original reason in the message.
        throw new Error(
          `${reason}. The built-in ${fallbackVersion} logic could not be loaded either (${this._describeError(fallbackError)}).`,
        );
      }

      return {
        files,
        meta: this._meta(normalizedVersion, fallbackVersion, "fallback", { reason }),
      };
    }
  }

  static _meta(requestedVersion, resolvedVersion, source, { reason = null, warnings = [] } = {}) {
    return {
      requestedVersion,
      resolvedVersion,
      source,
      usedFallback: source === "fallback",
      reason,
      warnings,
    };
  }

  /**
   * Turn a download failure into a sentence for the warning banner.
   * @param {unknown} error - Whatever the download rejected with.
   * @returns {string} A short description of what went wrong.
   */
  static _describeError(error) {
    if (error?.name === "AbortError") { return "The download did not finish in time"; }
    return error?.message || String(error);
  }

  static async _fetchLogicFiles(owner, tag, signal) {
    // Load all logic files in parallel
    const [logicHelpersFile, locationTable, boulderResult, bossesFile, overworldFile, ...dungeonResults] = await Promise.all([
      this._loadLogicFile(this._logicHelpersFileUrl(owner, tag), signal),
      this._loadLocationTable(this._locationListFileUrl(owner, tag), signal),
      this._loadBoulderTable(this._bouldersFileUrl(owner, tag), signal),
      this._loadLogicFile(this._logicFileUrl(owner, tag, "Bosses.json"), signal),
      this._loadLogicFile(this._logicFileUrl(owner, tag, "Overworld.json"), signal),
      ...DUNGEONS.flatMap(dungeonName => [
        this._loadLogicFile(this._logicFileUrl(owner, tag, `${dungeonName}.json`), signal).then(data => ({
          type: "normal",
          name: dungeonName,
          data,
        })),
        this._loadLogicFile(this._logicFileUrl(owner, tag, `${dungeonName} MQ.json`), signal).then(data => ({
          type: "mq",
          name: `${dungeonName} MQ`,
          data,
        })),
      ]),
    ]);

    const dungeonFiles = {};
    const dungeonMQFiles = {};
    dungeonResults.forEach(result => {
      if (result.type === "normal") {
        dungeonFiles[result.name] = result.data;
      } else {
        dungeonMQFiles[result.name] = result.data;
      }
    });

    const files = {
      logicHelpersFile,
      locationTable,
      boulderTable: boulderResult.boulderTable,
      dungeonFiles,
      dungeonMQFiles,
      bossesFile,
      overworldFile,
    };
    const warnings = boulderResult.warning ? [boulderResult.warning] : [];

    return { files, warnings };
  }

  static async _loadLogicFile(fileUrl, signal) {
    const fileData = await this._loadFileFromUrl(fileUrl, signal);
    try {
      return JSON.parse(this._validateLogicFile(fileData));
    } catch (error) {
      throw new Error(`${this._fileName(fileUrl)} could not be read as a logic file (${error.message})`);
    }
  }

  /**
   * Fetch and parse the location table that belongs to this branch's logic files.
   * @param {string} fileUrl - URL of the branch's LocationList.py.
   * @param {AbortSignal} [signal] - Cancels the download.
   * @returns {Promise<object>} Map of location name to [type, vanilla item].
   */
  static async _loadLocationTable(fileUrl, signal) {
    return parseLocationTable(await this._loadFileFromUrl(fileUrl, signal));
  }

  /**
   * Fetch and parse the boulder table, if this branch implements boulder shuffle.
   * @param {string} fileUrl - URL of the branch's Boulders.py.
   * @param {AbortSignal} [signal] - Cancels the download.
   * @returns {Promise<{boulderTable: object, warning: string|null}>} Map of boulder name to type, plus a warning when
   *   the table could not be fetched for a reason other than "this branch has none".
   */
  static async _loadBoulderTable(fileUrl, signal) {
    let response;
    let text;
    try {
      response = await fetch(fileUrl, { signal });
      if (response.status === 404) { return { boulderTable: {}, warning: null }; }
      if (!response.ok) {
        return { boulderTable: {}, warning: `Boulder table could not be fetched (HTTP ${response.status})` };
      }
      text = await response.text();
    } catch (error) {
      if (error?.name === "AbortError") { throw error; }
      return { boulderTable: {}, warning: `Boulder table could not be fetched (${error?.message || error})` };
    }

    return { boulderTable: parseBoulderTable(text), warning: null };
  }

  static async _loadFileFromUrl(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) { throw new Error(`HTTP ${response.status} fetching ${this._fileName(url)}`); }
    return await response.text();
  }

  /**
   * The file name at the end of a download URL, for messages people will read.
   * @param {string} url - A raw.githubusercontent.com file URL.
   * @returns {string} The decoded final path segment (e.g. "Spirit Temple MQ.json").
   */
  static _fileName(url) {
    const lastSegment = url.slice(url.lastIndexOf("/") + 1);
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }

  /**
   * Strip the Python-style comments and multi-line rule strings that keep the logic files from being valid JSON.
   * @param {string} fileData - Raw file contents fetched from the randomizer repository.
   * @returns {string} JSON text ready to be parsed.
   */
  static _validateLogicFile(fileData) {
    const matchFullLineComment = /^[ \t]*#[^\n]*\n?/gm;
    const matchTrailingComment = / +#[^\n]*/g;
    const matchMultilineString = / *\n +/g;

    const normalizedNewlines = fileData.replace(/\r\n?/g, "\n");
    const removedFullLineComments = normalizedNewlines.replace(matchFullLineComment, "");
    const removedComments = removedFullLineComments.replace(matchTrailingComment, "").trim();
    const removedMultilines = removedComments.replace(matchMultilineString, " ").trim();

    return removedMultilines;
  }

  static _logicHelpersFileUrl(owner, tag) {
    return `https://raw.githubusercontent.com/${owner}/OoT-Randomizer/${tag}/data/LogicHelpers.json`;
  }

  static _logicFileUrl(owner, tag, fileName) {
    return `https://raw.githubusercontent.com/${owner}/OoT-Randomizer/${tag}/data/World/${fileName}`;
  }

  static _locationListFileUrl(owner, tag) {
    return `https://raw.githubusercontent.com/${owner}/OoT-Randomizer/${tag}/LocationList.py`;
  }

  static _bouldersFileUrl(owner, tag) {
    return `https://raw.githubusercontent.com/${owner}/OoT-Randomizer/${tag}/Boulders.py`;
  }
}

export default LogicLoader;
