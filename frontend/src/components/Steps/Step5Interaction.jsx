import React, { useState, useEffect, useRef } from 'react';
import { getReport, chatWithReport } from '../../api/report';
import { getSimulationProfilesRealtime, interviewAgents } from '../../api/simulation';
import './Step5Interaction.css';

const Step5Interaction = ({ reportId, simulationId }) => {
    const [chatTarget, setChatTarget] = useState('report_agent');
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [selectedAgentIndex, setSelectedAgentIndex] = useState(null);

    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isSending, setIsSending] = useState(false);

    const [reportOutline, setReportOutline] = useState(null);
    const [generatedSections, setGeneratedSections] = useState({});
    const [profiles, setProfiles] = useState([]);

    const chatMessagesRef = useRef(null);

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

    useEffect(() => {
        const fetchData = async () => {
            if (reportId) {
                const rRes = await getReport(reportId);
                if (rRes.success && rRes.data) {
                    setReportOutline(rRes.data.outline);
                    setGeneratedSections(
                        rRes.data.sections.reduce((acc, s, i) => {
                            acc[i + 1] = s.content;
                            return acc;
                        }, {})
                    );
                }
            }
            if (simulationId) {
                const pRes = await getSimulationProfilesRealtime(simulationId);
                if (pRes.success && pRes.data?.profiles) {
                    setProfiles(pRes.data.profiles);
                }
            }
        };
        fetchData();
    }, [reportId, simulationId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (chatMessagesRef.current) {
                chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
            }
        }, 100);
    };

    const sendMessage = async () => {
        if (!chatInput.trim() || isSending) return;
        const message = chatInput.trim();
        setChatInput('');
        setChatHistory((prev) => [
            ...prev,
            { role: 'user', content: message, timestamp: Date.now() },
        ]);
        scrollToBottom();
        setIsSending(true);

        try {
            if (chatTarget === 'report_agent') {
                const historyForApi = chatHistory
                    .slice(-10)
                    .map((msg) => ({ role: msg.role, content: msg.content }));
                const res = await chatWithReport({
                    simulation_id: simulationId,
                    message,
                    chat_history: historyForApi,
                });
                if (res.success && res.data) {
                    setChatHistory((prev) => [
                        ...prev,
                        {
                            role: 'assistant',
                            content: res.data.response || res.data.answer || '无响应',
                            timestamp: Date.now(),
                        },
                    ]);
                }
            } else {
                if (selectedAgentIndex === null) throw new Error('请先选择一个模拟个体');
                let prompt = message;
                if (chatHistory.length > 1) {
                    const context = chatHistory
                        .slice(-6)
                        .map((m) => `${m.role === 'user' ? '提问者' : '你'}：${m.content}`)
                        .join('\\n');
                    prompt = `历史上下文：\\n${context}\\n\\n新问题：${message}`;
                }
                const res = await interviewAgents({
                    simulation_id: simulationId,
                    interviews: [{ agent_id: selectedAgentIndex, prompt }],
                });
                if (res.success && res.data) {
                    const resultData = res.data.result || res.data;
                    const resultsDict = resultData.results || resultData;
                    let responseContent = '(该平台未获得回复)';
                    if (typeof resultsDict === 'object' && !Array.isArray(resultsDict)) {
                        responseContent =
                            (
                                resultsDict[`reddit_${selectedAgentIndex}`] ||
                                resultsDict[`twitter_${selectedAgentIndex}`] ||
                                Object.values(resultsDict)[0] ||
                                {}
                            ).response || responseContent;
                    } else if (Array.isArray(resultsDict) && resultsDict.length > 0) {
                        responseContent =
                            resultsDict[0].response || resultsDict[0].answer || responseContent;
                    }
                    setChatHistory((prev) => [
                        ...prev,
                        { role: 'assistant', content: responseContent, timestamp: Date.now() },
                    ]);
                }
            }
        } catch (err) {
            setChatHistory((prev) => [
                ...prev,
                { role: 'assistant', content: `发生错误: ${err.message}`, timestamp: Date.now() },
            ]);
        } finally {
            setIsSending(false);
            scrollToBottom();
        }
    };

    const selectReportAgentChat = () => {
        setChatTarget('report_agent');
        setSelectedAgent(null);
        setSelectedAgentIndex(null);
        setShowAgentDropdown(false);
        setChatHistory([]);
    };

    const selectAgent = (agent, idx) => {
        setSelectedAgent(agent);
        setSelectedAgentIndex(idx);
        setChatTarget('agent');
        setShowAgentDropdown(false);
        setChatHistory([]);
    };

    return (
        <div className="interaction-panel">
            <div className="main-split-layout">
                {/* LEFT PANEL */}
                <div className="left-panel report-style">
                    {reportOutline ? (
                        <div className="report-content-wrapper">
                            <div className="report-header-block">
                                <div className="report-meta">
                                    <span className="report-tag">Prediction Report</span>
                                </div>
                                <h1 className="main-title">{reportOutline.title}</h1>
                                <p className="sub-title">{reportOutline.summary}</p>
                                <div className="header-divider"></div>
                            </div>

                            <div className="sections-list">
                                {reportOutline.sections?.map((section, idx) => (
                                    <div key={idx} className="report-section-item is-completed">
                                        <div className="section-header-row clickable">
                                            <span className="section-number">
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <h3 className="section-title">{section.title}</h3>
                                        </div>
                                        <div className="section-body">
                                            <div
                                                className="generated-content"
                                                dangerouslySetInnerHTML={{
                                                    __html: renderMarkdown(
                                                        generatedSections[idx + 1]
                                                    ),
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="waiting-placeholder">Loading report data...</div>
                    )}
                </div>

                {/* RIGHT PANEL Interaction Interface */}
                <div className="right-panel">
                    <div className="action-bar-tabs">
                        <button
                            className={`tab-pill ${chatTarget === 'report_agent' ? 'active' : ''}`}
                            onClick={selectReportAgentChat}
                        >
                            与Report Agent对话
                        </button>
                        <div className="agent-dropdown">
                            <button
                                className={`tab-pill agent-pill ${chatTarget === 'agent' ? 'active' : ''}`}
                                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                            >
                                {selectedAgent ? selectedAgent.username : '选择模拟个体对话 ▼'}
                            </button>
                            {showAgentDropdown && (
                                <div className="dropdown-menu">
                                    {profiles.map((agent, idx) => (
                                        <div
                                            key={idx}
                                            className="dropdown-item"
                                            onClick={() => selectAgent(agent, idx)}
                                        >
                                            {agent.username} ({agent.profession || '未知职业'})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="chat-container">
                        <div className="chat-messages" ref={chatMessagesRef}>
                            {chatHistory.length === 0 && (
                                <div className="chat-empty">选择对象即可开展沉浸式互动访谈。</div>
                            )}
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`chat-message ${msg.role}`}>
                                    <div className="message-content">
                                        <div className="message-header">
                                            <span className="sender-name">
                                                {msg.role === 'user'
                                                    ? 'You'
                                                    : chatTarget === 'report_agent'
                                                      ? 'Report Agent'
                                                      : selectedAgent?.username}
                                            </span>
                                        </div>
                                        <div
                                            className="message-text"
                                            dangerouslySetInnerHTML={{
                                                __html: renderMarkdown(msg.content),
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                            {isSending && (
                                <div className="chat-message assistant">
                                    <div className="message-content">Typing...</div>
                                </div>
                            )}
                        </div>

                        <div className="chat-input-area">
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="请输入想探讨的问题..."
                                disabled={isSending || (chatTarget === 'agent' && !selectedAgent)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                            />
                            <button
                                className="send-btn"
                                onClick={sendMessage}
                                disabled={!chatInput.trim() || isSending}
                            >
                                Sent
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step5Interaction;
