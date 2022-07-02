import { Route, Routes } from "react-router-dom";
import { TrackerProvider } from "./context/trackerContext";
import Welcome from "./scenes/Welcome/Welcome";
import Tracker from "./scenes/Tracker/Tracker";
import TrackerChecks from "./scenes/TrackerChecks";
import Layout from "./scenes/Layout";
import { LayoutProvider } from "./context/useLayout";

function App() {
  return (
    <div className="App">
      <Routes>
        {/* <Route path="" element={<Navigate to="/tracker" />} /> */}
        <Route path="" element={<Welcome />} />
        <Route
          path="/tracker"
          element={
            <TrackerProvider>
              <Tracker />
            </TrackerProvider>
          }
        />
        <Route
          path="/tracker/checks"
          element={
            <TrackerProvider>
              <TrackerChecks />
            </TrackerProvider>
          }
        />
        <Route
          path="/layout"
          element={
            <LayoutProvider>
              <TrackerProvider>
                <Layout />
              </TrackerProvider>
            </LayoutProvider>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
