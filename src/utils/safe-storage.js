/**
 * Access to localStorage is safeguarded to ensure application stability.
 * All failures are logged and result in fallback values rather than uncaught exceptions.
 */

/**
 * Reads and parses a JSON value from localStorage.
 * @param {string} key - The localStorage key.
 * @param {unknown} fallback - Value returned when the key is absent or unreadable.
 * @returns {unknown} The parsed value, or the fallback.
 */
export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) { return fallback; }
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed to read "${key}" from localStorage:`, err);
    return fallback;
  }
}

/**
 * Serializes and writes a JSON value to localStorage.
 * @param {string} key - The localStorage key.
 * @param {unknown} value - The value to serialize and store.
 * @returns {boolean} True when the write succeeded.
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Failed to write "${key}" to localStorage:`, err);
    return false;
  }
}

/**
 * Writes a raw string to localStorage.
 * @param {string} key - The localStorage key.
 * @param {string} value - The string to store.
 * @returns {boolean} True when the write succeeded.
 */
export function writeString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Failed to write "${key}" to localStorage:`, err);
    return false;
  }
}

/**
 * Removes keys from localStorage, ignoring individual failures.
 * @param {...string} keys - The localStorage keys to remove.
 */
export function removeKeys(...keys) {
  keys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Failed to remove "${key}" from localStorage:`, err);
    }
  });
}
