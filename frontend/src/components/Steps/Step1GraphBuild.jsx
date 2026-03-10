import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSimulation } from '../../api/simulation';
import './Step1GraphBuild.css';

const Step1GraphBuild = ({
    currentPhase = 0,
    projectData,
    ontologyProgress,
    buildProgress,
    graphData,
    systemLogs = []
}) => {
    const navigate = useNavigate();
    const logContentRef = useRef(null);
    const [selectedOntologyItem, setSelectedOntologyItem] = useState(null);
    const [creatingSimulation, setCreatingSimulation] = useState(false);

    const handleEnterEnvSetup = async () => {
        if (!projectData?.project_id || !projectData?.graph_id) {
            console.error('缺少项目或图谱信息');
            return;
        }

        setCreatingSimulation(true);

        try {
            const res = await createSimulation({
                project_id: projectData.project_id,
                graph_id: projectData.graph_id,
                enable_twitter: true,
                enable_reddit: true
            });

            if (res.success && res.data?.simulation_id) {
                navigate(`/simulation/${res.data.simulation_id}`);
            } else {
                console.error('创建模拟失败:', res.error);
                alert('创建模拟失败: ' + (res.error || '未知错误'));
            }
        } catch (err) {
            console.error('创建模拟异常:', err);
            alert('创建模拟异常: ' + err.message);
        } finally {
            setCreatingSimulation(false);
        }
    };

    const selectOntologyItem = (item, type) => {
        setSelectedOntologyItem({ ...item, itemType: type });
    };

    const graphStats = useMemo(() => {
        const nodes = graphData?.node_count || graphData?.nodes?.length || 0;
        const edges = graphData?.edge_count || graphData?.edges?.length || 0;
        const types = projectData?.ontology?.entity_types?.length || 0;
        return { nodes, edges, types };
    }, [graphData, projectData]);

    useEffect(() => {
        if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        }
    }, [systemLogs.length]);

    return (
        <div className="workbench-panel">
            <div className="scroll-container">
                {/* Step 01: Ontology */}
                <div className={`step-card ${currentPhase === 0 ? 'active' : ''} ${currentPhase > 0 ? 'completed' : ''}`}>
                    <div className="card-header">
                        <div className="step-info">
                            <span className="step-num">01</span>
                            <span className="step-title">本体生成</span>
                        </div>
                        <div className="step-status">
                            {currentPhase > 0 ? (
                                <span className="badge success">已完成</span>
                            ) : currentPhase === 0 ? (
                                <span className="badge processing">生成中</span>
                            ) : (
                                <span className="badge pending">等待</span>
                            )}
                        </div>
                    </div>

                    <div className="card-content">
                        <p className="api-note">POST /api/graph/ontology/generate</p>
                        <p className="description">
                            LLM分析文档内容与模拟需求，提取出现实种子，自动生成合适的本体结构
                        </p>

                        {currentPhase === 0 && ontologyProgress && (
                            <div className="progress-section">
                                <div className="spinner-sm"></div>
                                <span>{ontologyProgress.message || '正在分析文档...'}</span>
                            </div>
                        )}

                        {selectedOntologyItem && (
                            <div className="ontology-detail-overlay">
                                <div className="detail-header">
                                    <div className="detail-title-group">
                                        <span className="detail-type-badge">{selectedOntologyItem.itemType === 'entity' ? 'ENTITY' : 'RELATION'}</span>
                                        <span className="detail-name">{selectedOntologyItem.name}</span>
                                    </div>
                                    <button className="close-btn" onClick={() => setSelectedOntologyItem(null)}>×</button>
                                </div>
                                <div className="detail-body">
                                    <div className="detail-desc">{selectedOntologyItem.description}</div>

                                    {selectedOntologyItem.attributes?.length > 0 && (
                                        <div className="detail-section">
                                            <span className="section-label">ATTRIBUTES</span>
                                            <div className="attr-list">
                                                {selectedOntologyItem.attributes.map(attr => (
                                                    <div key={attr.name} className="attr-item">
                                                        <span className="attr-name">{attr.name}</span>
                                                        <span className="attr-type">({attr.type})</span>
                                                        <span className="attr-desc">{attr.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedOntologyItem.examples?.length > 0 && (
                                        <div className="detail-section">
                                            <span className="section-label">EXAMPLES</span>
                                            <div className="example-list">
                                                {selectedOntologyItem.examples.map(ex => (
                                                    <span key={ex} className="example-tag">{ex}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedOntologyItem.source_targets?.length > 0 && (
                                        <div className="detail-section">
                                            <span className="section-label">CONNECTIONS</span>
                                            <div className="conn-list">
                                                {selectedOntologyItem.source_targets.map((conn, idx) => (
                                                    <div key={idx} className="conn-item">
                                                        <span className="conn-node">{conn.source}</span>
                                                        <span className="conn-arrow">→</span>
                                                        <span className="conn-node">{conn.target}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {projectData?.ontology?.entity_types && (
                            <div className={`tags-container ${selectedOntologyItem ? 'dimmed' : ''}`}>
                                <span className="tag-label">GENERATED ENTITY TYPES</span>
                                <div className="tags-list">
                                    {projectData.ontology.entity_types.map(entity => (
                                        <span
                                            key={entity.name}
                                            className="entity-tag clickable"
                                            onClick={() => selectOntologyItem(entity, 'entity')}
                                        >
                                            {entity.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {projectData?.ontology?.edge_types && (
                            <div className={`tags-container ${selectedOntologyItem ? 'dimmed' : ''}`}>
                                <span className="tag-label">GENERATED RELATION TYPES</span>
                                <div className="tags-list">
                                    {projectData.ontology.edge_types.map(rel => (
                                        <span
                                            key={rel.name}
                                            className="entity-tag clickable"
                                            onClick={() => selectOntologyItem(rel, 'relation')}
                                        >
                                            {rel.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 02: Graph Build */}
                <div className={`step-card ${currentPhase === 1 ? 'active' : ''} ${currentPhase > 1 ? 'completed' : ''}`}>
                    <div className="card-header">
                        <div className="step-info">
                            <span className="step-num">02</span>
                            <span className="step-title">GraphRAG构建</span>
                        </div>
                        <div className="step-status">
                            {currentPhase > 1 ? (
                                <span className="badge success">已完成</span>
                            ) : currentPhase === 1 ? (
                                <span className="badge processing">{buildProgress?.progress || 0}%</span>
                            ) : (
                                <span className="badge pending">等待</span>
                            )}
                        </div>
                    </div>

                    <div className="card-content">
                        <p className="api-note">POST /api/graph/build</p>
                        <p className="description">
                            基于生成的本体，将文档自动分块后调用 Zep 构建知识图谱，提取实体和关系，并形成时序记忆与社区摘要
                        </p>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <span className="stat-value">{graphStats.nodes}</span>
                                <span className="stat-label">实体节点</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{graphStats.edges}</span>
                                <span className="stat-label">关系边</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{graphStats.types}</span>
                                <span className="stat-label">SCHEMA类型</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 03: Complete */}
                <div className={`step-card ${currentPhase === 2 ? 'active' : ''} ${currentPhase > 2 ? 'completed' : ''}`}>
                    <div className="card-header">
                        <div className="step-info">
                            <span className="step-num">03</span>
                            <span className="step-title">构建完成</span>
                        </div>
                        <div className="step-status">
                            {currentPhase >= 2 && <span className="badge accent">进行中</span>}
                        </div>
                    </div>

                    <div className="card-content">
                        <p className="api-note">POST /api/simulation/create</p>
                        <p className="description">图谱构建已完成，请进入下一步进行模拟环境搭建</p>
                        <button
                            className="action-btn"
                            disabled={currentPhase < 2 || creatingSimulation}
                            onClick={handleEnterEnvSetup}
                        >
                            {creatingSimulation && <span className="spinner-sm"></span>}
                            {creatingSimulation ? '创建中...' : '进入环境搭建 ➝'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="system-logs">
                <div className="log-header">
                    <span className="log-title">SYSTEM DASHBOARD</span>
                    <span className="log-id">{projectData?.project_id || 'NO_PROJECT'}</span>
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

export default Step1GraphBuild;
