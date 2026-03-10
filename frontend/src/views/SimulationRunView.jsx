import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import GraphPanel from '../components/GraphPanel';
import Step3Simulation from '../components/Steps/Step3Simulation';
import { getProject, getGraphData } from '../api/graph';
import { getSimulation } from '../api/simulation';
import './SimulationRunView.css';

const SimulationRunView = () => {
    const { simulationId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const maxRounds = searchParams.get('maxRounds')
        ? parseInt(searchParams.get('maxRounds'), 10)
        : null;

    const [projectData, setProjectData] = useState(null);

    const [viewMode, setViewMode] = useState('split');
    const [graphData, setGraphData] = useState(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const [systemLogs, setSystemLogs] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('processing');

    useEffect(() => {
        const fetchSimulationContext = async () => {
            if (simulationId) {
                const simRes = await getSimulation(simulationId);
                if (simRes.success && simRes.data) {
                    if (simRes.data.project_id) {
                        const pRes = await getProject(simRes.data.project_id);
                        if (pRes.success) {
                            setProjectData(pRes.data);
                            if (pRes.data.graph_id) {
                                setGraphLoading(true);
                                // In Vue it uses an interval, but here we'll just load it once for simplicity
                                // unless we really need the dynamic updates (which step3 does trigger internally but we might just refresh manually)
                                const gRes = await getGraphData(pRes.data.graph_id);
                                if (gRes.success) setGraphData(gRes.data);
                                setGraphLoading(false);
                            }
                        }
                    }
                }
            }
        };
        fetchSimulationContext();
    }, [simulationId]);

    const addLog = (msg) => {
        setSystemLogs((prev) => [
            ...prev.slice(-99),
            { time: new Date().toLocaleTimeString(), msg },
        ]);
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
        navigate(`/report/${params.reportId || ''}`);
    };

    const handleGoBack = () => {
        navigate(`/simulation/${simulationId}`);
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
                        <span className="step-num">Step 3/5</span>
                        <span className="step-name">开始模拟</span>
                    </div>
                    <div className="step-divider"></div>
                    <span className={`status-indicator ${currentStatus}`}>
                        <span className="dot"></span>
                        {currentStatus === 'completed'
                            ? 'Finished'
                            : currentStatus === 'error'
                              ? 'Error'
                              : 'Running'}
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
                    <Step3Simulation
                        simulationId={simulationId}
                        maxRounds={maxRounds}
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

export default SimulationRunView;
