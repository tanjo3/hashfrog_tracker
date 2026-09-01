import { useCallback, useEffect, useRef, useState } from "react";

import { getGeneratorVersionCache, getSettingsStringCache, useItems } from "../context/trackerContext";
import { setTooltipWarmingEnabled, warmRequirementsCache } from "../utils/expression-converter";
import Locations from "../utils/locations";
import LogicHelper from "../utils/logic-helper";
import LogicLoader from "../utils/logic-loader";
import SettingsHelper from "../utils/settings-helper";

const SETTINGS_DECODE_TIMEOUT_MS = 10000;

// SettingsHelper builds Sets from the first group, and the items reducer spreads the starting-item lists,
// so a non-list value in any of these would throw far away from the response that caused it.
const LIST_SETTINGS = [
  "mq_dungeons_specific",
  "dungeon_shortcuts",
  "allowed_tricks",
  "advanced_allowed_tricks",
  "adult_trade_start",
  "shuffle_child_trade",
  "disabled_locations",
  "starting_equipment",
  "starting_inventory",
  "starting_songs",
];

const CHECK_STRING_HINT = "Check the settings string and generator version, then try again.";

/**
 * Check that a decoded-settings response looks like settings before it reaches the logic.
 * Unknown keys remain allowed on purpose: forks add settings this tracker has never seen.
 * @param {unknown} settings - The `settings` field of the API response.
 * @returns {object} The validated settings object.
 * @throws {Error} When the response is not a usable settings object.
 */
const validateDecodedSettings = settings => {
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    throw new Error(`The settings service returned an unexpected response. ${CHECK_STRING_HINT}`);
  }

  const badLists = LIST_SETTINGS.filter(key => key in settings && !Array.isArray(settings[key]));
  if (badLists.length) {
    throw new Error(`The decoded settings look corrupted (${badLists.join(", ")} should be lists). ${CHECK_STRING_HINT}`);
  }

  if ("bridge" in settings && typeof settings.bridge !== "string") {
    throw new Error(`The decoded settings look corrupted (bridge should be text). ${CHECK_STRING_HINT}`);
  }

  return settings;
};

/**
 * Decode a settings string through the companion API, failing loudly on anything unusable.
 *
 * Every failure throws instead of returning undefined.
 * This prevents a session from running on silently applied default settings.
 * @param {string} generatorVersion - Generator version the string was made with.
 * @param {string} settingsString - The settings string to decode.
 * @param {AbortSignal} signal - Abort signal for timeout/unmount cancellation.
 * @returns {Promise<object>} The decoded settings.
 * @throws {Error} When the service is unreachable, errors, or returns a malformed body.
 */
const fetchDecodedSettings = async (generatorVersion, settingsString, signal) => {
  const url =
    `${process.env.REACT_APP_API_URL}/settings/string?` +
    new URLSearchParams({
      version: generatorVersion,
      settingsString: settingsString,
    });

  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("The settings service did not respond in time. Check your connection and try again.");
    }
    throw new Error("Could not reach the settings service. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(`Could not decode the settings string (the service responded with status ${response.status}). ${CHECK_STRING_HINT}`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The settings service returned an unreadable response. Try again in a moment.");
  }

  return validateDecodedSettings(body?.settings);
};

const useLogicInitialization = (options = {}) => {
  const { skip = false, warmTooltips = false } = options;
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Where the logic files came from (requested vs. resolved version, fallback reason, warnings)
  const [logicMeta, setLogicMeta] = useState(null);
  const { updateItemsFromLogic } = useItems();

  // Bumped by every (re)initialization and unmount.
  // This prevents an abandoned run's late responses from overwriting the state of a newer one.
  const generationRef = useRef(0);
  const abortRef = useRef(null);

  const initializeLogic = useCallback(async () => {
    if (skip) { return; }

    generationRef.current += 1;
    const generation = generationRef.current;
    const isStale = () => generationRef.current !== generation;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);
      setIsInitialized(false);
      setLogicMeta(null);

      const generatorVersion = getGeneratorVersionCache();
      const settingsString = getSettingsStringCache();

      // Load logic files for the specific generator version
      const { files: bundle, meta } = await LogicLoader.loadLogicFiles(generatorVersion, settingsString);
      if (isStale()) { return; }
      const { logicHelpersFile, locationTable, boulderTable, dungeonFiles, dungeonMQFiles, bossesFile, overworldFile } =
        bundle;
      setLogicMeta(meta);

      // Initialize SettingsHelper with version-specific defaults
      SettingsHelper.initialize(bundle);

      Locations.initialize(dungeonFiles, dungeonMQFiles, bossesFile, overworldFile, locationTable);

      if (!settingsString) {
        throw new Error(
          "No settings string was provided. Launch the tracker from the main page with a settings string or preset.",
        );
      }

      // The timeout only covers the settings decode.
      // The logic-file fetches above manage themselves.
      const timeout = setTimeout(() => controller.abort(), SETTINGS_DECODE_TIMEOUT_MS);
      let settings;
      try {
        settings = await fetchDecodedSettings(generatorVersion, settingsString, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
      if (isStale()) { return; }

      // Apply defaults and old-name transformations first so LogicHelper sees normalized settings
      SettingsHelper.setSettings(settings);

      // LogicHelper post-processes settings (e.g. mq_dungeons_mode "mq" expands
      // mq_dungeons_specific to all dungeons), so set SettingsHelper from its result.
      const finalSettings = LogicHelper.initialize(logicHelpersFile, SettingsHelper.settings, boulderTable);

      SettingsHelper.setSettings(finalSettings);
      updateItemsFromLogic(finalSettings); // Starting items.
      setIsInitialized(true);

      // Pre-build tooltip region caches, but only for scenes that show tooltips.
      setTooltipWarmingEnabled(warmTooltips);
      setTimeout(() => {
        if (!isStale()) { warmRequirementsCache(); }
      }, 0);
    } catch (err) {
      if (!isStale()) { setError(err); }
    } finally {
      if (!isStale()) { setIsLoading(false); }
    }
  }, [skip, warmTooltips, updateItemsFromLogic]);

  useEffect(() => {
    initializeLogic();

    return () => {
      // Stop an in-flight run from touching state (or the network) after unmount.
      generationRef.current += 1;
      abortRef.current?.abort();
    };
  }, [initializeLogic]);

  return { isLoading, error, isInitialized, logicMeta, retry: initializeLogic };
};

export default useLogicInitialization;
