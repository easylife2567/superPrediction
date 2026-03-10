import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Step4Report from '../components/Steps/Step4Report';
import { getReport } from '../api/report';
import './ReportView.css';

const ReportView = () => {
    const { reportId } = useParams();
    const navigate = useNavigate();

    const [simulationId, setSimulationId] = useState(null);
    const [systemLogs, setSystemLogs] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('processing');

    useEffect(() => {
        const fetchReportInfo = async () => {
            if (reportId) {
                // Just need to get the simulation context if accessible, 
                // to be able to navigate to Interaction which needs simulationId.
                const res = await getReport(reportId);
                if (res.success && res.data?.simulation_id) {
                    setSimulationId(res.data.simulation_id);
                }
            }
        };
        fetchReportInfo();
    }, [reportId]);

    const addLog = (msg) => {
        setSystemLogs(prev => [...prev.slice(-99), { time: new Date().toLocaleTimeString(), msg }]);
    };

    const handleNextStep = () => {
        if (simulationId) {
            navigate(`/interact/${simulationId}/${reportId}`);
        }
    };

    const handleGoBack = () => {
        if (simulationId) {
            navigate(`/simulation/${simulationId}/start`);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="main-view">
            <header className="app-header">
                <div className="header-left">
                    <div className="brand" onClick={() => navigate('/')}>MIROFISH</div>
                </div>
                <div className="header-center"></div>
                <div className="header-right">
                    <div className="workflow-step">
                        <span className="step-num">Step 4/5</span>
                        <span className="step-name">报告生成</span>
                    </div>
                    <div className="step-divider"></div>
                    <span className={`status-indicator ${currentStatus}`}>
                        <span className="dot"></span>
                        {currentStatus === 'success' ? 'Completed' : 'Generating'}
                    </span>
                </div>
            </header>

            <main className="content-area">
                <div className="full-width-panel" style={{ width: '100%', height: '100%' }}>
                    <Step4Report
                        reportId={reportId}
                        simulationId={simulationId}
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

export default ReportView;
