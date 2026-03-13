import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgentLog, getConsoleLog, getReportStatus, getReport } from '../../api/report';
import './Step4Report.css';

const Step4Report = ({
    reportId,
    simulationId,
    // systemLogs = [], // unused
    // onGoBack, // unused
    // onNextStep, // unused
    onAddLog,
    onUpdateStatus,
}) => {
    const navigate = useNavigate();

    const [agentLogs, setAgentLogs] = useState([]);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [reportOutline, setReportOutline] = useState(null);
    const [generatedSections, setGeneratedSections] = useState({});
    const [currentSectionIndex, setCurrentSectionIndex] = useState(null);
    const [isComplete, setIsComplete] = useState(false);
    const [expandedLogs, setExpandedLogs] = useState(new Set());
    const [collapsedSections, setCollapsedSections] = useState(new Set());

    const agentLogLineRef = useRef(0);
    const consoleLogLineRef = useRef(0);
    const pollTimerRef = useRef(null);
    const rightPanelRef = useRef(null);
    const logContentRef = useRef(null);

    const addLog = useCallback(
        (msg) => {
            onAddLog && onAddLog(msg);
        },
        [onAddLog]
    );

    const renderMarkdown = (content) => {
        if (!content) return '';
        let html = content.replace(/^##\s+.+\n+/, '');
        html = html.replace(
            /```(\w*)\n([\s\S]*?)```/g,
            '<pre class="code-block"><code>$2</code></pre>'
        );
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        html = html.replace(/^#### (.+)$/gm, '<h5 class="md-h5">$1</h5>');
        html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');
        return html;
    };

    const isSectionCompleted = (sectionIndex) => {
        return !!generatedSections[sectionIndex];
    };

    const toggleSectionCollapse = (idx) => {
        if (!generatedSections[idx + 1]) return;
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleLogExpand = (log) => {
        setExpandedLogs((prev) => {
            const next = new Set(prev);
            if (next.has(log.timestamp)) next.delete(log.timestamp);
            else next.add(log.timestamp);
            return next;
        });
    };

    const fetchLogs = async () => {
        if (!reportId) return;
        try {
            const aRes = await getAgentLog(reportId, agentLogLineRef.current);
            if (aRes.success && aRes.data && aRes.data.logs?.length > 0) {
                setAgentLogs((prev) => [...prev, ...aRes.data.logs]);
                agentLogLineRef.current = aRes.data.next_line;

                aRes.data.logs.forEach((log) => {
                    if (log.action === 'planning_complete' && log.details?.outline) {
                        setReportOutline(log.details.outline);
                    }
                    if (log.action === 'section_start') {
                        setCurrentSectionIndex(log.section_index);
                    }
                    if (log.action === 'section_complete' && log.details?.content) {
                        setGeneratedSections((prev) => ({
                            ...prev,
                            [log.section_index]: log.details.content,
                        }));
                    }
                    if (log.action === 'report_complete' && log.details?.full_report) {
                        setIsComplete(true);
                        onUpdateStatus && onUpdateStatus('success');
                        stopPolling();
                    }
                });
            }

            const cRes = await getConsoleLog(reportId, consoleLogLineRef.current);
            if (cRes.success && cRes.data && cRes.data.logs?.length > 0) {
                setConsoleLogs((prev) => [...prev, ...cRes.data.logs]);
                consoleLogLineRef.current = cRes.data.next_line;
            }

            if (!isComplete) {
                // check status just in case logging broke
                const sRes = await getReportStatus(reportId, simulationId);
                if (sRes.success === false || sRes.data?.status === 'failed') {
                    setIsComplete(true);
                    onUpdateStatus && onUpdateStatus('error');
                    stopPolling();
                    addLog(`生成状态异常: ${sRes.error || sRes.data?.error || '无法获取任务状态'}`);
                } else if (sRes.success && sRes.data?.status === 'completed' && !isComplete) {
                    setIsComplete(true);
                    const fullRes = await getReport(reportId);
                    if (fullRes.success && fullRes.data) {
                        setReportOutline(fullRes.data.outline);
                        setGeneratedSections(
                            fullRes.data.sections.reduce((acc, s, i) => {
                                acc[i + 1] = s.content;
                                return acc;
                            }, {})
                        );
                    }
                    onUpdateStatus && onUpdateStatus('success');
                    stopPolling();
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const startPolling = () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(fetchLogs, 2000);
    };
    const stopPolling = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    useEffect(() => {
        addLog(`Step4: 连接报告生成引擎 [${reportId}]`);
        if (reportId) {
            startPolling();
        }
        return () => stopPolling();
    }, [reportId]);

    useEffect(() => {
        if (rightPanelRef.current) {
            rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight;
        }
    }, [agentLogs.length]);

    useEffect(() => {
        if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        }
    }, [consoleLogs.length]);

    return (
        <div className="report-panel">
            <div className="main-split-layout">
                {/* LEFT PANEL */}
                <div className="left-panel report-style">
                    {reportOutline ? (
                        <div className="report-content-wrapper">
                            <div className="report-header-block">
                                <div className="report-meta">
                                    <span className="report-tag">Prediction Report</span>
                                    <span className="report-id">ID: {reportId}</span>
                                </div>
                                <h1 className="main-title">{reportOutline.title}</h1>
                                <p className="sub-title">{reportOutline.summary}</p>
                                <div className="header-divider"></div>
                            </div>

                            <div className="sections-list">
                                {reportOutline.sections?.map((section, idx) => {
                                    const sIdx = idx + 1;
                                    const isCompleted = isSectionCompleted(sIdx);
                                    const isActive = currentSectionIndex === sIdx;
                                    const isCollapsed = collapsedSections.has(idx);

                                    return (
                                        <div
                                            key={idx}
                                            className={`report-section-item ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''} ${!isCompleted && !isActive ? 'is-pending' : ''}`}
                                        >
                                            <div
                                                className={`section-header-row ${isCompleted ? 'clickable' : ''}`}
                                                onClick={() => toggleSectionCollapse(idx)}
                                            >
                                                <span className="section-number">
                                                    {String(sIdx).padStart(2, '0')}
                                                </span>
                                                <h3 className="section-title">{section.title}</h3>
                                                {isCompleted && (
                                                    <svg
                                                        className={`collapse-icon ${isCollapsed ? 'is-collapsed' : ''}`}
                                                        viewBox="0 0 24 24"
                                                        width="20"
                                                        height="20"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <polyline points="6 9 12 15 18 9"></polyline>
                                                    </svg>
                                                )}
                                            </div>

                                            {!isCollapsed && (
                                                <div className="section-body">
                                                    {isCompleted ? (
                                                        <div
                                                            className="generated-content"
                                                            dangerouslySetInnerHTML={{
                                                                __html: renderMarkdown(
                                                                    generatedSections[sIdx]
                                                                ),
                                                            }}
                                                        ></div>
                                                    ) : isActive ? (
                                                        <div className="loading-state">
                                                            <span className="loading-text">
                                                                正在生成 {section.title}...
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="waiting-placeholder">
                            <div className="waiting-animation">
                                <div className="waiting-ring"></div>
                                <div className="waiting-ring"></div>
                                <div className="waiting-ring"></div>
                            </div>
                            <span className="waiting-text">Waiting for Report Agent...</span>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL Workflow Details */}
                <div className="right-panel" ref={rightPanelRef}>
                    {isComplete && (
                        <button
                            className="next-step-btn"
                            onClick={() => navigate(`/interact/${simulationId}/${reportId}`)}
                        >
                            <span>进入深度互动</span>
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>
                    )}

                    <div className="workflow-timeline">
                        {agentLogs.map((log, idx) => {
                            const isExpanded = expandedLogs.has(log.timestamp);
                            return (
                                <div key={`${log.timestamp}-${idx}`} className="timeline-item">
                                    <div className="timeline-connector">
                                        <div className="connector-dot"></div>
                                        {idx < agentLogs.length - 1 && (
                                            <div className="connector-line"></div>
                                        )}
                                    </div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="action-label">{log.action}</span>
                                            <span className="action-time">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div
                                            className={`timeline-body ${!isExpanded ? 'collapsed' : ''}`}
                                            onClick={() => toggleLogExpand(log)}
                                        >
                                            {log.action === 'tool_call' && (
                                                <>
                                                    <div className="tool-badge">
                                                        {log.details?.tool_name}
                                                    </div>
                                                    {isExpanded && log.details?.parameters && (
                                                        <div className="log-detail-text">
                                                            {JSON.stringify(
                                                                log.details.parameters,
                                                                null,
                                                                2
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {log.action === 'tool_result' && (
                                                <>
                                                    <div className="result-meta">
                                                        Result received (
                                                        {log.details?.result_length} chars)
                                                    </div>
                                                    {isExpanded && log.details?.tool_result && (
                                                        <div className="log-detail-text">
                                                            {typeof log.details.tool_result ===
                                                            'string'
                                                                ? log.details.tool_result.slice(
                                                                      0,
                                                                      1000
                                                                  ) +
                                                                  (log.details.tool_result.length >
                                                                  1000
                                                                      ? '...'
                                                                      : '')
                                                                : JSON.stringify(
                                                                      log.details.tool_result,
                                                                      null,
                                                                      2
                                                                  )}
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {log.action === 'llm_response' && (
                                                <>
                                                    <div className="llm-meta">
                                                        Iter: {log.details?.iteration}
                                                    </div>
                                                    {isExpanded &&
                                                        (log.details?.response ||
                                                            log.details?.content) && (
                                                            <div className="log-detail-text">
                                                                {log.details.response ||
                                                                    log.details.content}
                                                            </div>
                                                        )}
                                                </>
                                            )}

                                            {/* Fallback for other actions like section_start, planning_complete */}
                                            {isExpanded &&
                                                ![
                                                    'tool_call',
                                                    'tool_result',
                                                    'llm_response',
                                                ].includes(log.action) && (
                                                    <div className="log-detail-text">
                                                        {log.details?.title ||
                                                            log.details?.content ||
                                                            log.details?.message ||
                                                            (log.details
                                                                ? JSON.stringify(
                                                                      log.details,
                                                                      null,
                                                                      2
                                                                  )
                                                                : '')}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {agentLogs.length === 0 && !isComplete && (
                            <div className="workflow-empty">
                                <span>Waiting for agent activity...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="console-logs">
                <div className="log-header">
                    <span className="log-title">CONSOLE OUTPUT</span>
                    <span className="log-id">{reportId || 'NO_REPORT'}</span>
                </div>
                <div className="log-content" ref={logContentRef}>
                    {consoleLogs.map((log, idx) => (
                        <div className="log-line" key={idx}>
                            <span className="log-msg">{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Step4Report;
