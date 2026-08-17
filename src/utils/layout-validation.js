/**
 * Minimal structural validation performed on layouts.
 * The validation process is limited to fields accessed by the application.
 * This ensures that valid legacy layouts are not rejected due to the presence of optional fields.
 * @param {unknown} layout - The candidate layout value.
 * @returns {boolean} True when the value is safe to use as a layout.
 */
export function isValidLayout(layout) {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return false;
  }

  const { layoutConfig, components } = layout;
  if (!layoutConfig || typeof layoutConfig !== "object" || Array.isArray(layoutConfig)) {
    return false;
  }
  if (!Number.isFinite(layoutConfig.width) || !Number.isFinite(layoutConfig.height)) {
    return false;
  }

  return Array.isArray(components);
}
