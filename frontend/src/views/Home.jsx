import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HistoryDatabase from '../components/HistoryDatabase';
import useUploadStore from '../store/useUploadStore';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // zustand 统一管理文件上传的全生命周期状态
    const { files, simulationRequirement, addFiles, removeFile, setSimulationRequirement } =
        useUploadStore();

    const [loading, setLoading] = useState(false); // 控制提交按钮是否禁用
    const [isDragOver, setIsDragOver] = useState(false); // 控制拖拽区域是否高亮

    const canSubmit = simulationRequirement.trim() !== '' && files.length > 0; // 控制提交按钮是否启用

    // 触发文件选择对话框
    const triggerFileInput = () => {
        if (!loading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // 处理文件选择事件
    const handleFileSelect = (event) => {
        const selectedFiles = Array.from(event.target.files);
        filterAndAddFiles(selectedFiles);
    };

    // 处理拖拽区域的事件
    const handleDragOver = (e) => {
        e.preventDefault();
        if (!loading) setIsDragOver(true);
    };

    // 处理拖拽区域的离开事件
    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    // 处理拖拽区域的释放事件
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (loading) return;
        const droppedFiles = Array.from(e.dataTransfer.files);
        filterAndAddFiles(droppedFiles);
    };

    // 过滤并添加文件到状态中
    const filterAndAddFiles = (newFiles) => {
        const validFiles = newFiles.filter((file) => {
            const ext = file.name.split('.').pop().toLowerCase();
            return ['pdf', 'md', 'txt'].includes(ext);
        });
        addFiles(validFiles);
    };

    // 处理提交按钮点击事件
    const startSimulation = () => {
        if (!canSubmit || loading) return;
        setLoading(true);
        // Context keeps the files and simulationRequirement. Navigate to process with "new" ID.
        navigate('/process/new');
    };

    return (
        <div className="home-container">
            <nav className="navbar">
                <div className="nav-brand">MIROFISH</div>
            </nav>

            <div className="main-content">
                <section className="hero-section">
                    <div className="hero-left">
                        <div className="tag-row">
                            <span className="theme-tag">简洁通用的群体智能引擎</span>
                        </div>
                        <h1 className="main-title">
                            上传任意报告
                            <br />
                            <span className="gradient-text">即刻推演未来</span>
                        </h1>
                        <div className="hero-desc">
                            <p>
                                即使只有一段文字，<span className="highlight-bold">MiroFish</span>{' '}
                                也能基于其中的现实种子，全自动生成与之对应的至多
                                <span className="highlight-primary">百万级Agent</span>
                                构成的平行世界。通过上帝视角注入变量，在复杂的群体交互中寻找动态环境下的
                                <span className="highlight-code">“局部最优解”</span>
                            </p>
                            <p className="slogan-text">
                                让未来在 Agent 群中预演，让决策在百战后胜出
                                <span className="blinking-cursor">_</span>
                            </p>
                        </div>
                    </div>
                </section>

                <section className="dashboard-section">
                    <div className="left-panel">
                        <div className="panel-header">
                            <span className="status-dot">■</span> 系统状态
                        </div>
                        <h2 className="section-title">准备就绪</h2>
                        <p className="section-desc">
                            预测引擎待命中，可上传多份非结构化数据以初始化模拟序列
                        </p>
                        <div className="metrics-row">
                            <div className="metric-card">
                                <div className="metric-value">低成本</div>
                                <div className="metric-label">常规模拟平均5$/次</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-value">高可用</div>
                                <div className="metric-label">最多百万级Agent模拟</div>
                            </div>
                        </div>
                        <div className="steps-container">
                            <div className="steps-header">
                                <span className="diamond-icon">◇</span> 工作流序列
                            </div>
                            <div className="workflow-list">
                                {[
                                    {
                                        title: '图谱构建',
                                        desc: '现实种子提取 & 个体与群体记忆注入 & GraphRAG构建',
                                    },
                                    {
                                        title: '环境搭建',
                                        desc: '实体关系抽取 & 人设生成 & 环境配置Agent注入仿真参数',
                                    },
                                    {
                                        title: '开始模拟',
                                        desc: '双平台并行模拟 & 自动解析预测需求 & 动态更新时序记忆',
                                    },
                                    {
                                        title: '报告生成',
                                        desc: 'ReportAgent拥有丰富的工具集与模拟后环境进行深度交互',
                                    },
                                    {
                                        title: '深度互动',
                                        desc: '与模拟世界中的任意一位进行对话 & 与ReportAgent进行对话',
                                    },
                                ].map((step, idx) => (
                                    <div key={idx} className="workflow-item">
                                        <span className="step-num">
                                            {String(idx + 1).padStart(2, '0')}
                                        </span>
                                        <div className="step-info">
                                            <div className="step-title">{step.title}</div>
                                            <div className="step-desc">{step.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="right-panel">
                        <div className="console-box">
                            <div className="console-section">
                                <div className="console-header">
                                    <span className="console-label">01 / 现实种子</span>
                                    <span className="console-meta">支持格式: PDF, MD, TXT</span>
                                </div>
                                <div
                                    className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${files.length > 0 ? 'has-files' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={triggerFileInput}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept=".pdf,.md,.txt"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                        disabled={loading}
                                    />
                                    {files.length === 0 ? (
                                        <div className="upload-placeholder">
                                            <div className="upload-icon">↑</div>
                                            <div className="upload-title">拖拽文件上传</div>
                                            <div className="upload-hint">或点击浏览文件系统</div>
                                        </div>
                                    ) : (
                                        <div className="file-list">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="file-item">
                                                    <span className="file-icon">📄</span>
                                                    <span className="file-name">{file.name}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeFile(idx);
                                                        }}
                                                        className="remove-btn"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="console-divider">
                                <span>输入参数</span>
                            </div>

                            <div className="console-section input-section">
                                <div className="console-header">
                                    <span className="console-label">&gt;_ 02 / 模拟提示词</span>
                                </div>
                                <div className="input-wrapper">
                                    <textarea
                                        value={simulationRequirement}
                                        onChange={(e) => setSimulationRequirement(e.target.value)}
                                        className="code-input"
                                        placeholder="// 用自然语言输入模拟或预测需求（例.武大若发布撤销肖某处分的公告，会引发什么舆情走向）"
                                        rows="6"
                                        disabled={loading}
                                    ></textarea>
                                    <div className="model-badge">引擎: MiroFish-V1.0</div>
                                </div>
                            </div>

                            <div className="console-section btn-section">
                                <button
                                    className="start-engine-btn"
                                    onClick={startSimulation}
                                    disabled={!canSubmit || loading}
                                >
                                    {!loading ? <span>启动引擎</span> : <span>初始化中...</span>}
                                    <span className="btn-arrow">→</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <HistoryDatabase />
            </div>
        </div>
    );
};

export default Home;
