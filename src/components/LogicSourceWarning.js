import { useState } from "react";

import Alert from "react-bootstrap/Alert";

/**
 * Warns when the logic in use may not match the generator version the player asked for.
 *
 * It stays silent in normal cases and only appears when availability might be wrong.
 * @param {object} props - Component props.
 * @param {object|null} props.meta - The `logicMeta` reported by useLogicInitialization.
 * @returns {object|null} A dismissible warning element, or null when the logic is trustworthy.
 */
const LogicSourceWarning = ({ meta }) => {
  const [dismissed, setDismissed] = useState(false);

  if (!meta || dismissed) { return null; }

  const hasWarnings = meta.warnings?.length > 0;
  if (!meta.usedFallback && !hasWarnings) { return null; }

  const headline = meta.usedFallback
    ? `Logic for version ${meta.requestedVersion} could not be loaded. Using the built-in ${meta.resolvedVersion} logic instead.`
    : "Some of the logic could not be loaded.";

  return (
    <Alert
      variant="warning"
      dismissible
      onClose={() => setDismissed(true)}
      className="logic-source-warning py-2 small mb-0"
    >
      <strong>{headline}</strong> The checks shown as available may be incorrect for your seed.{" "}
      <details className="d-inline-block">
        <summary className="d-inline text-decoration-underline" style={{ cursor: "pointer" }}>Details</summary>
        <ul className="mb-0 mt-1 ps-3">
          {meta.usedFallback && meta.reason && <li>{meta.reason}</li>}
          {hasWarnings && meta.warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      </details>
    </Alert>
  );
};

export default LogicSourceWarning;
