import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphPanel from '../components/GraphPanel';
import Step1GraphBuild from '../components/Steps/Step1GraphBuild';
import {
    getProject,
    getGraphData,
    generateOntology,
    buildGraph,
    getTaskStatus,
} from '../api/graph';
import useUploadStore from '../store/useUploadStore';
import './MainView.css';

const MainView = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();

    // Store
    const pendingUpload = useUploadStore((state) => state.pendingUpload); // 获取上传状态
    const clearPendingUpload = useUploadStore((state) => state.clearPendingUpload); // 清除上传状态

    // Layout
    const [viewMode, setViewMode] = useState('split'); // 视图模式，split 或 single

    // Data
    const [projectData, setProjectData] = useState(null); // 项目数据
    const [graphData, setGraphData] = useState(null); // 图数据
    const [graphLoading, setGraphLoading] = useState(false); // 图数据加载状态

    const [currentPhase, setCurrentPhase] = useState(-1); // 当前阶段
    const [ontologyProgress, setOntologyProgress] = useState(null); // 本体进度
    const [buildProgress, setBuildProgress] = useState(null); // 图构建进度

    const [systemLogs, setSystemLogs] = useState([]); // 系统日志
    const [error, setError] = useState(''); // 错误信息

    // Refs WebSocketysdweWEWEdsadsds【=】---------------------------0·
    const pollTimerRef = useRef(null); // 轮询定时器引用
    const graphPollTimerRef = useRef(null); // 图数据轮询定时器引用
    const currentProjectIdRef = useRef(projectId); // 当前项目ID引用

    // 项目数据轮询
    useEffect(() => {
        currentProjectIdRef.current = projectData?.project_id || projectId;
    }, [projectId, projectData]);

    // 系统日志添加
    const addLog = (msg) => {
        setSystemLogs((prev) => {
            const time =
                new Date().toLocaleTimeString('en-US', { hour12: false }) +
                '.' +
                new Date().getMilliseconds().toString().padStart(3, '0');
            return [...prev.slice(-99), { time, msg }];
        });
    };

    // 轮询停止
    const stopPolling = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const stopGraphPolling = () => {
        if (graphPollTimerRef.current) {
            clearInterval(graphPollTimerRef.current);
            graphPollTimerRef.current = null;
            addLog('Graph polling stopped.');
        }
    };

    // 根据任务状态更新当前阶段
    const updatePhaseByStatus = (status) => {
        switch (status) {
            case 'created':
            case 'ontology_generated':
                setCurrentPhase(0);
                break;
            case 'graph_building':
                setCurrentPhase(1);
                break;
            case 'graph_completed':
                setCurrentPhase(2);
                break;
            case 'failed':
                setError('Project failed');
                break;
            default:
                break;
        }
    };

    // 加载完整图数据
    const loadGraph = async (graphId) => {
        setGraphLoading(true);
        addLog(`Loading full graph data: ${graphId}`);
        try {
            const res = await getGraphData(graphId);
            if (res.success) {
                setGraphData(res.data);
                addLog('Graph data loaded successfully.');
            } else {
                addLog(`Failed to load graph data: ${res.error}`);
            }
        } catch (e) {
            addLog(`Exception loading graph: ${e.message}`);
        } finally {
            setGraphLoading(false);
        }
    };

    // 图数据轮询
    const fetchGraphData = async (id) => {
        try {
            const projRes = await getProject(id);
            if (projRes.success && projRes.data.graph_id) {
                const gRes = await getGraphData(projRes.data.graph_id);
                if (gRes.success) {
                    setGraphData(gRes.data);
                    const nodeCount = gRes.data.node_count || gRes.data.nodes?.length || 0;
                    const edgeCount = gRes.data.edge_count || gRes.data.edges?.length || 0;
                    addLog(`Graph data refreshed. Nodes: ${nodeCount}, Edges: ${edgeCount}`);
                }
            }
        } catch (err) {
            console.warn('Graph fetch error:', err);
        }
    };

    // 图数据轮询
    const startGraphPolling = (id) => {
        stopGraphPolling(); // 必须在新建前清除上次的孤儿定时器
        addLog('Started polling for graph data...');
        fetchGraphData(id);
        graphPollTimerRef.current = setInterval(() => {
            const currentId = currentProjectIdRef.current || id;
            if (currentId) fetchGraphData(currentId);
        }, 10000);
    };

    const pollTaskStatusFunc = async (taskId) => {
        try {
            const res = await getTaskStatus(taskId);
            if (res.success) {
                const task = res.data;

                setBuildProgress((prev) => {
                    if (task.message && task.message !== prev?.message) {
                        addLog(task.message);
                    }
                    return { progress: task.progress || 0, message: task.message };
                });

                if (task.status === 'completed') {
                    addLog('Graph build task completed.');
                    stopPolling();
                    stopGraphPolling();
                    setCurrentPhase(2);

                    const pId = currentProjectIdRef.current;
                    if (pId) {
                        const projRes = await getProject(pId);
                        if (projRes.success && projRes.data.graph_id) {
                            setProjectData(projRes.data);
                            await loadGraph(projRes.data.graph_id);
                        }
                    }
                } else if (task.status === 'failed') {
                    stopPolling();
                    setError(task.error);
                    addLog(`Graph build task failed: ${task.error}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startPollingTask = (taskId) => {
        stopPolling(); // 必须在新建前清除上次的孤儿定时器
        pollTaskStatusFunc(taskId);
        pollTimerRef.current = setInterval(() => pollTaskStatusFunc(taskId), 2000);
    };

    const startBuildGraph = async (id) => {
        try {
            setCurrentPhase(1);
            setBuildProgress({ progress: 0, message: 'Starting build...' });
            addLog('Initiating graph build...');

            const res = await buildGraph({ project_id: id });
            if (res.success) {
                addLog(`Graph build task started. Task ID: ${res.data.task_id}`);
                startGraphPolling(id);
                startPollingTask(res.data.task_id);
            } else {
                setError(res.error);
                addLog(`Error starting build: ${res.error}`);
            }
        } catch (err) {
            setError(err.message);
            addLog(`Exception in startBuildGraph: ${err.message}`);
        }
    };

    const handleNewProject = async () => {
        if (!pendingUpload.files || pendingUpload.files.length === 0) {
            setError('No pending files found.');
            addLog('Error: No pending files found for new project.');
            return;
        }

        try {
            setCurrentPhase(0);
            setOntologyProgress({ message: 'Uploading and analyzing docs...' });
            addLog('Starting ontology generation: Uploading files...');

            const formData = new FormData();
            pendingUpload.files.forEach((f) => formData.append('files', f));
            formData.append('simulation_requirement', pendingUpload.simulationRequirement);

            const res = await generateOntology(formData);
            if (res.success) {
                clearPendingUpload();
                setProjectData(res.data);
                setOntologyProgress(null);
                addLog(`Ontology generated successfully for project ${res.data.project_id}`);

                navigate(`/process/${res.data.project_id}`, { replace: true });
                await startBuildGraph(res.data.project_id);
            } else {
                setError(res.error || 'Ontology generation failed');
                addLog(`Error generating ontology: ${res.error}`);
            }
        } catch (err) {
            setError(err.message);
            addLog(`Exception in handleNewProject: ${err.message}`);
        }
    };

    const loadProject = async (id) => {
        try {
            addLog(`Loading project ${id}...`);
            const res = await getProject(id);
            if (res.success) {
                setProjectData(res.data);
                addLog(`Project loaded. Status: ${res.data.status}`);
                updatePhaseByStatus(res.data.status);

                if (res.data.status === 'ontology_generated' && !res.data.graph_id) {
                    await startBuildGraph(id);
                } else if (res.data.status === 'graph_building' && res.data.graph_build_task_id) {
                    setCurrentPhase(1);
                    startGraphPolling(id);
                    startPollingTask(res.data.graph_build_task_id);
                } else if (res.data.status === 'graph_completed' && res.data.graph_id) {
                    setCurrentPhase(2);
                    await loadGraph(res.data.graph_id);
                }
            } else {
                setError(res.error);
                addLog(`Error loading project: ${res.error}`);
            }
        } catch (err) {
            setError(err.message);
            addLog(`Exception in loadProject: ${err.message}`);
        }
    };

    useEffect(() => {
        const initProject = async () => {
            addLog('Project view initialized.');
            if (projectId === 'new') {
                await handleNewProject();
            } else if (projectId) {
                await loadProject(projectId);
            }
        };
        initProject();

        return () => {
            stopPolling();
            stopGraphPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const refreshGraph = async () => {
        if (projectData?.graph_id) {
            await loadGraph(projectData.graph_id);
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
                        <span className="step-num">Step 1/5</span>
                        <span className="step-name">图谱构建</span>
                    </div>
                    <div className="step-divider"></div>
                    <span
                        className={`status-indicator ${error ? 'error' : currentPhase >= 2 ? 'completed' : 'processing'}`}
                    >
                        <span className="dot"></span>
                        {error
                            ? 'Error'
                            : currentPhase >= 2
                              ? 'Ready'
                              : currentPhase === 1
                                ? 'Building Graph'
                                : currentPhase === 0
                                  ? 'Generating Ontology'
                                  : 'Initializing'}
                    </span>
                </div>
            </header>

            <main className="content-area">
                <div className="panel-wrapper left" style={getLeftStyle()}>
                    <GraphPanel
                        graphData={graphData}
                        loading={graphLoading}
                        currentPhase={currentPhase}
                        onRefresh={refreshGraph}
                        onToggleMaximize={() => toggleMaximize('graph')}
                    />
                </div>
                <div className="panel-wrapper right" style={getRightStyle()}>
                    <Step1GraphBuild
                        currentPhase={currentPhase}
                        projectData={projectData}
                        ontologyProgress={ontologyProgress}
                        buildProgress={buildProgress}
                        graphData={graphData}
                        systemLogs={systemLogs}
                    />
                </div>
            </main>
        </div>
    );
};

export default MainView;
