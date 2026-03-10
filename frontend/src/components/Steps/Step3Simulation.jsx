import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSimulation, getRunStatus, getRunStatusDetail } from '../../api/simulation';
import { generateReport } from '../../api/report';
import './Step3Simulation.css';

const Step3Simulation = ({
    simulationId,
    maxRounds,
    minutesPerRound = 30,
    systemLogs = [],
    onAddLog,
    onUpdateStatus,
}) => {
    const navigate = useNavigate();
    const scrollContainerRef = useRef(null);
    const logContentRef = useRef(null);

    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [phase, setPhase] = useState(0);
    const [runStatus, setRunStatus] = useState({});
    const [allActions, setAllActions] = useState([]);

    const actionIdsRef = useRef(new Set());
    const prevTwitterRoundRef = useRef(0);
    const prevRedditRoundRef = useRef(0);

    const statusTimerRef = useRef(null);
    const detailTimerRef = useRef(null);

    const formatElapsedTime = useCallback(
        (currentRound) => {
            if (!currentRound || currentRound <= 0) return '0h 0m';
            const totalMinutes = currentRound * minutesPerRound;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${minutes}m`;
        },
        [minutesPerRound]
    );

    const twitterElapsedTime = useMemo(
        () => formatElapsedTime(runStatus.twitter_current_round || 0),
        [runStatus.twitter_current_round, formatElapsedTime]
    );
    const redditElapsedTime = useMemo(
        () => formatElapsedTime(runStatus.reddit_current_round || 0),
        [runStatus.reddit_current_round, formatElapsedTime]
    );

    const addLog = useCallback(
        (msg) => {
            onAddLog && onAddLog(msg);
        },
        [onAddLog]
    );

    const resetAllState = () => {
        setPhase(0);
        setRunStatus({});
        setAllActions([]);
        actionIdsRef.current = new Set();
        prevTwitterRoundRef.current = 0;
        prevRedditRoundRef.current = 0;
        stopPolling();
    };

    const doStartSimulation = async (force = false) => {
        if (!simulationId) {
            addLog('错误：缺少 simulationId');
            return;
        }

        if (force) {
            resetAllState();
        }

        if (force) {
            addLog('正在启动双平台并行模拟...');
        } else {
            addLog('正在恢复模拟状态...');
        }
        onUpdateStatus && onUpdateStatus('processing');

        try {
            const params = {
                simulation_id: simulationId,
                platform: 'parallel',
                force: force,
                enable_graph_memory_update: true,
            };
            if (maxRounds) {
                params.max_rounds = maxRounds;
                if (force) addLog(`设置最大模拟轮数: ${maxRounds}`);
            }
            if (force) addLog('已开启动态图谱更新模式');

            const res = await startSimulation(params);
            if (res.success && res.data) {
                if (res.data.force_restarted) addLog('✓ 已清理旧的模拟日志，重新开始模拟');
                else addLog('✓ 模拟状态已恢复');

                setPhase(1);
                setRunStatus(res.data);
                startStatusPolling();
                startDetailPolling();
            } else {
                addLog(`✗ 启动失败: ${res.error || '未知错误'}`);
                onUpdateStatus && onUpdateStatus('error');
            }
        } catch (err) {
            addLog(`✗ 启动异常: ${err.message}`);
            onUpdateStatus && onUpdateStatus('error');
        }
    };

    const startStatusPolling = () => {
        if (statusTimerRef.current) clearInterval(statusTimerRef.current);
        statusTimerRef.current = setInterval(fetchRunStatus, 2000);
    };
    const startDetailPolling = () => {
        if (detailTimerRef.current) clearInterval(detailTimerRef.current);
        detailTimerRef.current = setInterval(fetchRunStatusDetail, 3000);
    };
    const stopPolling = () => {
        if (statusTimerRef.current) {
            clearInterval(statusTimerRef.current);
            statusTimerRef.current = null;
        }
        if (detailTimerRef.current) {
            clearInterval(detailTimerRef.current);
            detailTimerRef.current = null;
        }
    };

    const checkPlatformsCompleted = (data) => {
        if (!data) return false;
        const twitterCompleted = data.twitter_completed === true;
        const redditCompleted = data.reddit_completed === true;
        const twitterEnabled =
            data.twitter_actions_count > 0 || data.twitter_running || twitterCompleted;
        const redditEnabled =
            data.reddit_actions_count > 0 || data.reddit_running || redditCompleted;

        if (!twitterEnabled && !redditEnabled) return false;
        if (twitterEnabled && !twitterCompleted) return false;
        if (redditEnabled && !redditCompleted) return false;

        return true;
    };

    const fetchRunStatus = async () => {
        if (!simulationId) return;
        try {
            const res = await getRunStatus(simulationId);
            if (res.success && res.data) {
                const data = res.data;
                setRunStatus(data);

                if (data.twitter_current_round > prevTwitterRoundRef.current) {
                    addLog(
                        `[Plaza] R${data.twitter_current_round}/${data.total_rounds} | T:${data.twitter_simulated_hours || 0}h | A:${data.twitter_actions_count}`
                    );
                    prevTwitterRoundRef.current = data.twitter_current_round;
                }

                if (data.reddit_current_round > prevRedditRoundRef.current) {
                    addLog(
                        `[Community] R${data.reddit_current_round}/${data.total_rounds} | T:${data.reddit_simulated_hours || 0}h | A:${data.reddit_actions_count}`
                    );
                    prevRedditRoundRef.current = data.reddit_current_round;
                }

                const isCompleted =
                    data.runner_status === 'completed' || data.runner_status === 'stopped';
                const platformsCompleted = checkPlatformsCompleted(data);

                if (isCompleted || platformsCompleted) {
                    if (platformsCompleted && !isCompleted) addLog('✓ 检测到所有平台模拟已结束');
                    addLog('✓ 模拟已完成');
                    setPhase(2);
                    stopPolling();
                    onUpdateStatus && onUpdateStatus('completed');
                }
            }
        } catch {
            /* ignore */
        }
    };

    const fetchRunStatusDetail = async () => {
        if (!simulationId) return;
        try {
            const res = await getRunStatusDetail(simulationId);
            if (res.success && res.data) {
                const serverActions = res.data.all_actions || [];
                const newActions = [];
                serverActions.forEach((action) => {
                    const actionId =
                        action.id ||
                        `${action.timestamp}-${action.platform}-${action.agent_id}-${action.action_type}`;
                    if (!actionIdsRef.current.has(actionId)) {
                        actionIdsRef.current.add(actionId);
                        newActions.push({ ...action, _uniqueId: actionId });
                    }
                });
                if (newActions.length > 0) {
                    setAllActions((prev) => [...prev, ...newActions]);
                }
            }
        } catch {
            /* ignore */
        }
    };

    const handleNextStep = async () => {
        if (!simulationId) {
            addLog('错误：缺少 simulationId');
            return;
        }
        if (isGeneratingReport) {
            addLog('报告生成请求已发送，请稍候...');
            return;
        }

        setIsGeneratingReport(true);
        addLog('正在启动报告生成...');
        try {
            const res = await generateReport({
                simulation_id: simulationId,
                force_regenerate: true,
            });
            if (res.success && res.data) {
                addLog(`✓ 报告生成任务已启动: ${res.data.report_id}`);
                navigate(`/report/${res.data.report_id}`);
            } else {
                addLog(`✗ 启动报告生成失败: ${res.error || '未知错误'}`);
                setIsGeneratingReport(false);
            }
        } catch (err) {
            addLog(`✗ 启动报告生成异常: ${err.message}`);
            setIsGeneratingReport(false);
        }
    };

    useEffect(() => {
        addLog('Step3 模拟运行初始化');
        const checkAndStart = async () => {
            if (simulationId) {
                try {
                    const statusRes = await getRunStatus(simulationId);
                    // If running or has progress (current_round > 0), resume (force=false)
                    // Otherwise force start (force=true) to ensure clean state
                    const shouldResume =
                        statusRes.success &&
                        (statusRes.data.runner_status === 'running' ||
                            (statusRes.data.current_round && statusRes.data.current_round > 0));

                    if (shouldResume) {
                        addLog('检测到已有进度，尝试恢复...');
                        await doStartSimulation(false);
                    } else {
                        await doStartSimulation(true);
                    }
                } catch {
                    await doStartSimulation(true);
                }
            }
        };
        checkAndStart();

        return () => stopPolling();
        // eslint-disable-next-line
    }, [simulationId]);

    useEffect(() => {
        if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        }
    }, [systemLogs.length]);

    return (
        <div className="simulation-panel">
            {/* Top Control Bar */}
            <div className="control-bar">
                <div className="status-group">
                    {/* Twitter 平台进度 */}
                    <div
                        className={`platform-status twitter ${runStatus.twitter_running ? 'active' : ''} ${runStatus.twitter_completed ? 'completed' : ''}`}
                    >
                        <div className="platform-header">
                            <span className="platform-name">Info Plaza</span>
                        </div>
                        <div className="platform-stats">
                            <span className="stat">
                                <span className="stat-label">ROUND</span>
                                <span className="stat-value mono">
                                    {runStatus.twitter_current_round || 0}
                                </span>
                            </span>
                            <span className="stat">
                                <span className="stat-label">TIME</span>
                                <span className="stat-value mono">{twitterElapsedTime}</span>
                            </span>
                        </div>
                    </div>

                    {/* Reddit 平台进度 */}
                    <div
                        className={`platform-status reddit ${runStatus.reddit_running ? 'active' : ''} ${runStatus.reddit_completed ? 'completed' : ''}`}
                    >
                        <div className="platform-header">
                            <span className="platform-name">Topic Community</span>
                        </div>
                        <div className="platform-stats">
                            <span className="stat">
                                <span className="stat-label">ROUND</span>
                                <span className="stat-value mono">
                                    {runStatus.reddit_current_round || 0}
                                </span>
                            </span>
                            <span className="stat">
                                <span className="stat-label">TIME</span>
                                <span className="stat-value mono">{redditElapsedTime}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="action-controls">
                    <button
                        className="action-btn primary"
                        disabled={phase !== 2 || isGeneratingReport}
                        onClick={handleNextStep}
                    >
                        {isGeneratingReport ? '启动中...' : '开始生成结果报告 →'}
                    </button>
                </div>
            </div>

            <div className="main-content-area" ref={scrollContainerRef}>
                <div className="timeline-feed">
                    {allActions.length === 0 ? (
                        <div className="waiting-state">
                            <div className="pulse-ring"></div>
                            <span>Waiting for agent actions...</span>
                        </div>
                    ) : (
                        <div className="timeline-axis"></div>
                    )}

                    {allActions.map((action) => (
                        <div key={action._uniqueId} className={`timeline-item ${action.platform}`}>
                            <div className="timeline-card">
                                <div className="card-header">
                                    <span className="agent-name">Agent @{action.agent_name}</span>
                                    <span className={`action-badge ${action.action_type}`}>
                                        {action.action_type}
                                    </span>
                                </div>
                                <div className="card-body">
                                    <div className="content-text">
                                        {action.action_args?.content ||
                                            action.action_args?.query ||
                                            'Interaction Action Taken'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="system-logs">
                <div className="log-header">
                    <span className="log-title">SIMULATION MONITOR</span>
                    <span className="log-id">{simulationId || 'NO_SIMULATION'}</span>
                </div>
                <div className="log-content" ref={logContentRef}>
                    {systemLogs.map((log, idx) => (
                        <div className="log-line" key={idx}>
                            <span className="log-time">{log.time}</span>
                            <span className="log-msg">{log.msg}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Step3Simulation;
