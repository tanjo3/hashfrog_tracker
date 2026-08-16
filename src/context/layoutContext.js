import { createContext, useContext, useReducer } from "react";

import defaultLayout from "../layouts/hashfrog.json";
import { isValidLayout } from "../utils/layout-validation";
import { readJSON, writeJSON } from "../utils/safe-storage";

/**
 * Retrieves the layout from localStorage or returns the default.
 * @returns {object} The initial layout object.
 */
function getInitialLayout() {
  const layout = readJSON("layout", null);
  if (isValidLayout(layout)) {
    return layout;
  }
  if (layout !== null) {
    console.warn("Ignoring saved layout with unexpected shape. Using default layout.");
  }
  return { ...defaultLayout };
}

/**
 * Persists the layout to localStorage.
 * @param {object} layout - The layout object to cache.
 */
function setLayoutCache(layout) {
  writeJSON("layout", layout);
}

const LayoutContext = createContext();

/**
 * Layout context reducer.
 * @param {object} _state - The current state (unused, replaced by action payload).
 * @param {object} action - The dispatched action.
 * @returns {object} The new layout state.
 */
function reducer(_state, action) {
  switch (action.type) {
    case "LAYOUT_UPDATE": {
      setLayoutCache(action.payload);
      return { ...action.payload };
    }
    case "LAYOUT_DEFAULT": {
      setLayoutCache(defaultLayout);
      return { ...defaultLayout };
    }
    default:
      throw new Error();
  }
}

/**
 * Provides layout state and dispatch to child components.
 * @param {object} props - React component props.
 * @returns {object} The context provider.
 */
function LayoutProvider(props) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialLayout);

  return <LayoutContext.Provider value={{ state, dispatch }} {...props} />;
}

const useLayout = () => useContext(LayoutContext);

export { LayoutProvider, useLayout };
