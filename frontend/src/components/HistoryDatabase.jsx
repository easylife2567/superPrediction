import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSimulationHistory, deleteSimulation, restoreSimulation } from '../api/simulation';
import './HistoryDatabase.css';

const CARDS_PER_ROW = 4;
const CARD_WIDTH = 280;
const CARD_HEIGHT = 280;
const CARD_GAP = 24;

const HistoryDatabase = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const historyContainerRef = useRef(null);

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveringCard, setHoveringCard] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    
    // Deletion State
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletedProject, setDeletedProject] = useState(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const undoTimerRef = useRef(null);

    const observerRef = useRef(null);
    const isAnimatingRef = useRef(false);
    const expandDebounceTimerRef = useRef(null);
    const pendingStateRef = useRef(null);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const response = await getSimulationHistory(20);
            if (response && response.success) {
                setProjects(response.data || []);
            }
        } catch (error) {
            console.error('加载历史项目失败:', error);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (location.pathname === '/') {
            loadHistory();
        }
    }, [location.pathname]);

    const initObserver = useCallback(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const shouldExpand = entry.isIntersecting;
                pendingStateRef.current = shouldExpand;

                if (expandDebounceTimerRef.current) {
                    clearTimeout(expandDebounceTimerRef.current);
                    expandDebounceTimerRef.current = null;
                }

                if (isAnimatingRef.current) return;

                setIsExpanded((prevExpanded) => {
                    if (shouldExpand === prevExpanded) {
                        pendingStateRef.current = null;
                        return prevExpanded;
                    }

                    const delay = shouldExpand ? 50 : 200;
                    expandDebounceTimerRef.current = setTimeout(() => {
                        if (isAnimatingRef.current) return;
                        if (pendingStateRef.current === null || pendingStateRef.current === prevExpanded) return;

                        isAnimatingRef.current = true;
                        setIsExpanded(pendingStateRef.current);
                        pendingStateRef.current = null;

                        setTimeout(() => {
                            isAnimatingRef.current = false;
                            if (pendingStateRef.current !== null && pendingStateRef.current !== prevExpanded) {
                                expandDebounceTimerRef.current = setTimeout(() => {
                                    if (pendingStateRef.current !== null && pendingStateRef.current !== prevExpanded) {
                                        isAnimatingRef.current = true;
                                        setIsExpanded(pendingStateRef.current);
                                        pendingStateRef.current = null;
                                        setTimeout(() => {
                                            isAnimatingRef.current = false;
                                        }, 750);
                                    }
                                }, 100);
                            }
                        }, 750);
                    }, delay);

                    return prevExpanded;
                });
            });
        }, {
            threshold: [0.4, 0.6, 0.8],
            rootMargin: '0px 0px -150px 0px'
        });

        if (historyContainerRef.current) {
            observerRef.current.observe(historyContainerRef.current);
        }
    }, []);

    useEffect(() => {
        loadHistory().then(() => {
            setTimeout(() => initObserver(), 100);
        });

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
            if (expandDebounceTimerRef.current) clearTimeout(expandDebounceTimerRef.current);
        };
    }, [initObserver]);

    // Delete Handlers
    const handleDeleteClick = (e, project) => {
        e.stopPropagation(); // Prevent opening detail modal
        setProjectToDelete(project);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        
        try {
            setIsDeleting(true);
            const result = await deleteSimulation(projectToDelete.simulation_id, true, "User initiated deletion");
            
            if (result && result.success) {
                // Remove from list
                setProjects(prev => prev.filter(p => p.simulation_id !== projectToDelete.simulation_id));
                
                // Close modals
                if (selectedProject && selectedProject.simulation_id === projectToDelete.simulation_id) {
                    setSelectedProject(null);
                }
                
                // Show Undo Toast
                setDeletedProject(projectToDelete);
                setProjectToDelete(null);
                setShowUndoToast(true);
                
                // Auto hide toast after 10 seconds
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                undoTimerRef.current = setTimeout(() => {
                    setShowUndoToast(false);
                    setDeletedProject(null);
                }, 10000);
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败: ' + (error.message || '未知错误'));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUndo = async () => {
        if (!deletedProject) return;
        
        try {
            await restoreSimulation(deletedProject.simulation_id);
            
            // Reload list or add back manually
            loadHistory();
            
            setShowUndoToast(false);
            setDeletedProject(null);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        } catch (error) {
            console.error('恢复失败:', error);
            alert('恢复失败: ' + (error.message || '未知错误'));
        }
    };

    // Helpers
    const formatSimulationId = (simulationId) => {
        if (!simulationId) return 'SIM_UNKNOWN';
        const prefix = simulationId.replace('sim_', '').slice(0, 6);
        return `SIM_${prefix.toUpperCase()}`;
    };

    const getCardStyle = (index) => {
        const total = projects.length;
        const transition = 'transform 700ms cubic-bezier(0.23, 1, 0.32, 1), opacity 700ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease, border-color 0.3s ease';

        if (isExpanded) {
            const row = Math.floor(index / CARDS_PER_ROW);
            const currentRowStart = row * CARDS_PER_ROW;
            const currentRowCards = Math.min(CARDS_PER_ROW, total - currentRowStart);
            const rowWidth = currentRowCards * CARD_WIDTH + (currentRowCards - 1) * CARD_GAP;

            const startX = -(rowWidth / 2) + (CARD_WIDTH / 2);
            const colInRow = index % CARDS_PER_ROW;
            const x = startX + colInRow * (CARD_WIDTH + CARD_GAP);
            const y = 20 + row * (CARD_HEIGHT + CARD_GAP);

            return {
                transform: `translate(${x}px, ${y}px) rotate(0deg) scale(1)`,
                zIndex: 100 + index, opacity: 1, transition
            };
        } else {
            const centerIndex = (total - 1) / 2;
            const offset = index - centerIndex;
            const x = offset * 35;
            const y = 25 + Math.abs(offset) * 8;
            const r = offset * 3;
            const s = 0.95 - Math.abs(offset) * 0.05;

            return {
                transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`,
                zIndex: 10 + index, opacity: 1, transition
            };
        }
    };

    const containerStyle = useMemo(() => {
        if (!isExpanded) return { minHeight: '420px' };
        const total = projects.length;
        if (total === 0) return { minHeight: '280px' };
        const rows = Math.ceil(total / CARDS_PER_ROW);
        const expandedHeight = rows * CARD_HEIGHT + (rows - 1) * CARD_GAP + 10;
        return { minHeight: `${expandedHeight}px` };
    }, [isExpanded, projects.length]);

    const getProgressClass = (simulation) => {
        const current = simulation.current_round || 0;
        const total = simulation.total_rounds || 0;
        if (total === 0 || current === 0) return 'not-started';
        if (current >= total) return 'completed';
        return 'in-progress';
    };

    const formatRounds = (simulation) => {
        const current = simulation.current_round || 0;
        const total = simulation.total_rounds || 0;
        if (total === 0) return '未开始';
        return `${current}/${total} 轮`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toISOString().slice(0, 10);
        } catch {
            return dateStr?.slice(0, 10) || '';
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } catch { return ''; }
    };

    const truncateText = (text, maxLength) => (!text ? '' : text.length > maxLength ? text.slice(0, maxLength) + '...' : text);
    const getSimulationTitle = (req) => (!req ? '未命名模拟' : (req.length > 20 ? req.slice(0, 20) + '...' : req.slice(0, 20)));
    const getFileType = (filename) => {
        if (!filename) return 'other';
        const ext = filename.split('.').pop()?.toLowerCase();
        const typeMap = {
            'pdf': 'pdf', 'doc': 'doc', 'docx': 'doc', 'xls': 'xls', 'xlsx': 'xls', 'csv': 'xls', 'ppt': 'ppt', 'pptx': 'ppt',
            'txt': 'txt', 'md': 'txt', 'json': 'code', 'jpg': 'img', 'jpeg': 'img', 'png': 'img', 'gif': 'img', 'zip': 'zip', 'rar': 'zip', '7z': 'zip'
        };
        return typeMap[ext] || 'other';
    };
    const getFileTypeLabel = (filename) => (!filename ? 'FILE' : filename.split('.').pop()?.toUpperCase() || 'FILE');
    const truncateFilename = (filename, maxLength) => {
        if (!filename) return '未知文件';
        if (filename.length <= maxLength) return filename;
        const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
        const nameWithoutExt = filename.slice(0, filename.length - ext.length);
        return nameWithoutExt.slice(0, maxLength - ext.length - 3) + '...' + ext;
    };

    return (
        <div className={`history-database ${projects.length === 0 && !loading ? 'no-projects' : ''}`} ref={historyContainerRef}>
            {(projects.length > 0 || loading) && (
                <div className="tech-grid-bg">
                    <div className="grid-pattern"></div>
                    <div className="gradient-overlay"></div>
                </div>
            )}

            <div className="section-header">
                <div className="section-line"></div>
                <span className="section-title">推演记录</span>
                <div className="section-line"></div>
            </div>

            {projects.length > 0 && (
                <div className={`cards-container ${isExpanded ? 'expanded' : ''}`} style={containerStyle}>
                    {projects.map((project, index) => (
                        <div
                            key={project.simulation_id}
                            className={`project-card ${isExpanded ? 'expanded' : ''} ${hoveringCard === index ? 'hovering' : ''}`}
                            style={getCardStyle(index)}
                            onMouseEnter={() => setHoveringCard(index)}
                            onMouseLeave={() => setHoveringCard(null)}
                            onClick={() => setSelectedProject(project)}
                        >
                            <div className="card-delete-btn" onClick={(e) => handleDeleteClick(e, project)} title="删除记录">
                                ×
                            </div>
                            <div className="card-header">
                                <span className="card-id">{formatSimulationId(project.simulation_id)}</span>
                                <div className="card-status-icons">
                                    <span className={`status-icon ${project.project_id ? 'available' : 'unavailable'}`} title="图谱构建">◇</span>
                                    <span className="status-icon available" title="环境搭建">◈</span>
                                    <span className={`status-icon ${project.report_id ? 'available' : 'unavailable'}`} title="分析报告">◆</span>
                                </div>
                            </div>

                            <div className="card-files-wrapper">
                                <div className="corner-mark top-left-only"></div>
                                {project.files && project.files.length > 0 ? (
                                    <div className="files-list">
                                        {project.files.slice(0, 3).map((file, fileIndex) => (
                                            <div key={fileIndex} className="file-item">
                                                <span className={`file-tag ${getFileType(file.filename)}`}>{getFileTypeLabel(file.filename)}</span>
                                                <span className="file-name">{truncateFilename(file.filename, 20)}</span>
                                            </div>
                                        ))}
                                        {project.files.length > 3 && (
                                            <div className="files-more">+{project.files.length - 3} 个文件</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="files-empty">
                                        <span className="empty-file-icon">◇</span>
                                        <span className="empty-file-text">暂无文件</span>
                                    </div>
                                )}
                            </div>

                            <h3 className="card-title">{getSimulationTitle(project.simulation_requirement)}</h3>
                            <p className="card-desc">{truncateText(project.simulation_requirement, 55)}</p>

                            <div className="card-footer">
                                <div className="card-datetime">
                                    <span className="card-date">{formatDate(project.created_at)}</span>
                                    <span className="card-time">{formatTime(project.created_at)}</span>
                                </div>
                                <span className={`card-progress ${getProgressClass(project)}`}>
                                    <span className="status-dot">●</span> {formatRounds(project)}
                                </span>
                            </div>
                            <div className="card-bottom-line"></div>
                        </div>
                    ))}
                </div>
            )}

            {loading && (
                <div className="loading-state">
                    <span className="loading-spinner"></span>
                    <span className="loading-text">加载中...</span>
                </div>
            )}

            {selectedProject && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedProject(null); }}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <div className="modal-title-section">
                                <span className="modal-id">{formatSimulationId(selectedProject.simulation_id)}</span>
                                <span className={`modal-progress ${getProgressClass(selectedProject)}`}>
                                    <span className="status-dot">●</span> {formatRounds(selectedProject)}
                                </span>
                                <span className="modal-create-time">{formatDate(selectedProject.created_at)} {formatTime(selectedProject.created_at)}</span>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedProject(null)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="modal-section">
                                <div className="modal-label">模拟需求</div>
                                <div className="modal-requirement">{selectedProject.simulation_requirement || '无'}</div>
                            </div>
                            <div className="modal-section">
                                <div className="modal-label">关联文件</div>
                                {selectedProject.files && selectedProject.files.length > 0 ? (
                                    <div className="modal-files">
                                        {selectedProject.files.map((file, index) => (
                                            <div key={index} className="modal-file-item">
                                                <span className={`file-tag ${getFileType(file.filename)}`}>{getFileTypeLabel(file.filename)}</span>
                                                <span className="modal-file-name">{file.filename}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="modal-empty">暂无关联文件</div>
                                )}
                            </div>
                        </div>

                        <div className="modal-divider">
                            <span className="divider-line"></span>
                            <span className="divider-text">操作</span>
                            <span className="divider-line"></span>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="modal-btn btn-simulation"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => {
                                    if (selectedProject.report_id) {
                                        navigate(`/report/${selectedProject.report_id}`);
                                    } else if (selectedProject.total_rounds > 0) {
                                        navigate(`/simulation/${selectedProject.simulation_id}/start`);
                                    } else {
                                        navigate(`/simulation/${selectedProject.simulation_id}`);
                                    }
                                    setSelectedProject(null);
                                }}
                            >
                                <span className="btn-icon">
                                    {selectedProject.report_id ? '◆' : '◈'}
                                </span>
                                <span className="btn-text">
                                    {selectedProject.report_id ? '查看报告' : '继续推演'}
                                </span>
                            </button>
                            
                            <button
                                className="modal-btn delete-btn"
                                onClick={(e) => handleDeleteClick(e, selectedProject)}
                            >
                                <span className="btn-icon">×</span>
                                <span className="btn-text">删除记录</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {projectToDelete && (
                <div className="confirm-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setProjectToDelete(null); }}>
                    <div className="confirm-modal-content">
                        <div className="confirm-title">
                            <span className="confirm-icon">⚠</span>
                            确认删除
                        </div>
                        <div className="confirm-message">
                            确定要删除推演记录 <strong>{formatSimulationId(projectToDelete.simulation_id)}</strong> 吗？
                            <br/>
                            <span style={{fontSize: '0.8rem', color: '#6B7280'}}>此操作将移至回收站，并在一段时间后永久删除。</span>
                        </div>
                        
                        <div className="confirm-actions">
                            <button 
                                className="confirm-btn cancel" 
                                onClick={() => setProjectToDelete(null)}
                                disabled={isDeleting}
                            >
                                取消
                            </button>
                            <button 
                                className="confirm-btn delete" 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? '删除中...' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Undo Toast */}
            {showUndoToast && (
                <div className="toast-notification">
                    <span className="toast-message">已删除 1 条记录</span>
                    <button className="toast-undo-btn" onClick={handleUndo}>撤销</button>
                    <button 
                        style={{background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', marginLeft: '8px'}}
                        onClick={() => setShowUndoToast(false)}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

export default HistoryDatabase;
