import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Step5Interaction from '../components/Steps/Step5Interaction';
import './InteractionView.css';

const InteractionView = () => {
    const { reportId, simulationId } = useParams();
    const navigate = useNavigate();

    return (
        <div className="main-view">
            <header className="app-header">
                <div className="header-left">
                    <div className="brand" onClick={() => navigate('/')}>
                        MIROFISH
                    </div>
                </div>
                <div className="header-center"></div>
                <div className="header-right">
                    <div className="workflow-step">
                        <span className="step-num">Step 5/5</span>
                        <span className="step-name">深度互动</span>
                    </div>
                    <div className="step-divider"></div>
                    <span className={`status-indicator success`}>
                        <span className="dot"></span>
                        Active
                    </span>
                </div>
            </header>

            <main className="content-area">
                <div className="full-width-panel" style={{ width: '100%', height: '100%' }}>
                    <Step5Interaction reportId={reportId} simulationId={simulationId} />
                </div>
            </main>
        </div>
    );
};

export default InteractionView;
