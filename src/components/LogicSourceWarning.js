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

  return (
    <Alert
      variant="warning"
      dismissible
      onClose={() => setDismissed(true)}
      className="mx-3 mt-3 mb-0 py-2 small"
    >
      {meta.usedFallback && (
        <p className="mb-1">
          <strong>Logic files for version {meta.requestedVersion} could not be loaded.</strong> Using the built-in{" "}
          {meta.resolvedVersion} logic instead. The checks shown as available may be incorrect for your seed.
          {meta.reason && <span className="d-block text-secondary">Reason: {meta.reason}</span>}
        </p>
      )}
      {hasWarnings && (
        <ul className="mb-0 ps-3">
          {meta.warnings.map(warning => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
};

export default LogicSourceWarning;
