import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './views/Home';
import MainView from './views/MainView';
import SimulationView from './views/SimulationView';
import SimulationRunView from './views/SimulationRunView';
import ReportView from './views/ReportView';
import InteractionView from './views/InteractionView';
import useProcessStore from './store/useProcessStore';

function App() {
  // Cleanup old sessions on app load
  useEffect(() => {
    useProcessStore.getState().cleanupOldSessions();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/process/:projectId" element={<MainView />} />
        <Route path="/simulation/:simulationId" element={<SimulationView />} />
        <Route path="/simulation/:simulationId/start" element={<SimulationRunView />} />
        <Route path="/report/:reportId" element={<ReportView />} />
        <Route path="/interact/:simulationId/:reportId" element={<InteractionView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
