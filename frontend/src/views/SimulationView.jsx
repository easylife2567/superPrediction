import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphPanel from '../components/GraphPanel';
import Step2EnvSetup from '../components/Steps/Step2EnvSetup';
import { getProject, getGraphData } from '../api/graph';
import { getSimulation } from '../api/simulation';
import useProcessStore from '../store/useProcessStore';
import './SimulationView.css';

const SimulationView = () => {
    const { simulationId } = useParams();
    const navigate = useNavigate();

    const updateSession = useProcessStore((state) => state.updateSession);
    const getSession = useProcessStore((state) => state.getSession);

    const [viewMode, setViewMode] = useState('split');
    const [projectData, setProjectData] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const [systemLogs, setSystemLogs] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('processing');

    useEffect(() => {
        const fetchSimulationContext = async () => {
            if (simulationId) {
                // Restore logs from session
                const session = getSession(simulationId);
                if (session?.logs) {
                    setSystemLogs(session.logs);
                }

                const simRes = await getSimulation(simulationId);
                if (simRes.success && simRes.data?.project_id) {
                    const res = await getProject(simRes.data.project_id);
                    if (res.success && res.data) {
                        setProjectData(res.data);
                        if (res.data.graph_id) {
                            setGraphLoading(true);
                            const gRes = await getGraphData(res.data.graph_id);
                            if (gRes.success) setGraphData(gRes.data);
                            setGraphLoading(false);
                        }
                    }
                }
            }
        };
        fetchSimulationContext();
    }, [simulationId]);

    // Conflict detection
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'mirofish-process-storage') {
                try {
                    const newVal = JSON.parse(e.newValue);
                    const newSession = newVal?.state?.sessions?.[simulationId];
                    // If session was updated externally
                    if (newSession) {
                        // Optional: Notify user or auto-update (risky)
                        console.log('Session updated in another tab');
                        // For now, we just log it. A full sync would require more complex logic.
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [simulationId]);

    const addLog = (msg) => {
        setSystemLogs((prev) => {
            const newLogs = [...prev.slice(-99), { time: new Date().toLocaleTimeString(), msg }];
            updateSession(simulationId, { logs: newLogs });
            return newLogs;
        });
    };

    const refreshGraph = async () => {
        if (projectData?.graph_id) {
            setGraphLoading(true);
            const res = await getGraphData(projectData.graph_id);
            if (res.success) setGraphData(res.data);
            setGraphLoading(false);
        }
    };

    const handleNextStep = (params = {}) => {
        let url = `/simulation/${simulationId}/start`;
        if (params.maxRounds) {
            url += `?maxRounds=${params.maxRounds}`;
        }
        navigate(url);
    };

    const handleGoBack = () => {
        if (projectData?.project_id) {
            navigate(`/process/${projectData.project_id}`);
        } else {
            navigate('/');
        }
    };

    const toggleMaximize = (target) => {
        setViewMode((prev) => (prev === target ? 'split' : target));
    };

    const getLeftStyle = () => {
        if (viewMode === 'graph') return { width: '100%', opacity: 1, transform: 'translateX(0)' };
        if (viewMode === 'workbench')
            return { width: '0%', opacity: 0, transform: 'translateX(-20px)' };
        return { width: '50%', opacity: 1, transform: 'translateX(0)' };
    };

    const getRightStyle = () => {
        if (viewMode === 'workbench')
            return { width: '100%', opacity: 1, transform: 'translateX(0)' };
        if (viewMode === 'graph') return { width: '0%', opacity: 0, transform: 'translateX(20px)' };
        return { width: '50%', opacity: 1, transform: 'translateX(0)' };
    };

    return (
        <div className="main-view">
            <header className="app-header">
                <div className="header-left">
                    <div className="brand" onClick={() => navigate('/')}>
                        MIROFISH
                    </div>
                </div>
                <div className="header-center">
                    <div className="view-switcher">
                        {['graph', 'split', 'workbench'].map((mode) => (
                            <button
                                key={mode}
                                className={`switch-btn ${viewMode === mode ? 'active' : ''}`}
                                onClick={() => setViewMode(mode)}
                            >
                                {{ graph: '图谱', split: '双栏', workbench: '工作台' }[mode]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="header-right">
                    <div className="workflow-step">
                        <span className="step-num">Step 2/5</span>
                        <span className="step-name">环境搭建</span>
                    </div>
                    <div className="step-divider"></div>
                    <span className={`status-indicator ${currentStatus}`}>
                        <span className="dot"></span>
                        {currentStatus === 'completed'
                            ? 'Ready'
                            : currentStatus === 'error'
                              ? 'Error'
                              : 'Preparing'}
                    </span>
                </div>
            </header>

            <main className="content-area">
                <div className="panel-wrapper left" style={getLeftStyle()}>
                    <GraphPanel
                        graphData={graphData}
                        loading={graphLoading}
                        currentPhase={2}
                        onRefresh={refreshGraph}
                        onToggleMaximize={() => toggleMaximize('graph')}
                    />
                </div>
                <div className="panel-wrapper right" style={getRightStyle()}>
                    <Step2EnvSetup
                        simulationId={simulationId}
                        projectData={projectData}
                        graphData={graphData}
                        systemLogs={systemLogs}
                        onGoBack={handleGoBack}
                        onNextStep={handleNextStep}
                        onAddLog={addLog}
                        onUpdateStatus={setCurrentStatus}
                    />
                </div>
            </main>
        </div>
    );
};

export default SimulationView;
