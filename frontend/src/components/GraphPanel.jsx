import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import './GraphPanel.css';

const GraphPanel = ({ graphData, loading, currentPhase, isSimulating, onRefresh, onToggleMaximize }) => {
    const graphContainerRef = useRef(null);
    const graphSvgRef = useRef(null);

    const [selectedItem, setSelectedItem] = useState(null);
    const [showEdgeLabels, setShowEdgeLabels] = useState(true);
    const [expandedSelfLoops, setExpandedSelfLoops] = useState(new Set());
    const [showSimulationFinishedHint, setShowSimulationFinishedHint] = useState(false);
    const wasSimulatingRef = useRef(false);

    // D3 内部缓存对象
    const d3Refs = useRef({
        currentSimulation: null,
        linkLabels: null,
        linkLabelBg: null,
    });

    useEffect(() => {
        if (wasSimulatingRef.current && !isSimulating) {
            setShowSimulationFinishedHint(true);
        }
        wasSimulatingRef.current = isSimulating;
    }, [isSimulating]);

    const dismissFinishedHint = () => setShowSimulationFinishedHint(false);

    const toggleSelfLoop = (id) => {
        setExpandedSelfLoops((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const entityTypes = useMemo(() => {
        if (!graphData?.nodes) return [];
        const typeMap = {};
        const colors = ['#FF6B35', '#004E89', '#7B2D8E', '#1A936F', '#C5283D', '#E9724C', '#3498db', '#9b59b6', '#27ae60', '#f39c12'];

        graphData.nodes.forEach(node => {
            const type = node.labels?.find(l => l !== 'Entity') || 'Entity';
            if (!typeMap[type]) {
                typeMap[type] = { name: type, count: 0, color: colors[Object.keys(typeMap).length % colors.length] };
            }
            typeMap[type].count++;
        });
        return Object.values(typeMap);
    }, [graphData]);

    const formatDateTime = useCallback((dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
        } catch {
            return dateStr;
        }
    }, []);

    const closeDetailPanel = () => {
        setSelectedItem(null);
        setExpandedSelfLoops(new Set());
    };

    // D3 Render logic
    useEffect(() => {
        if (!graphSvgRef.current || !graphData) return;

        // Stop prev sim
        if (d3Refs.current.currentSimulation) d3Refs.current.currentSimulation.stop();

        const container = graphContainerRef.current;
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(graphSvgRef.current)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);

        svg.selectAll('*').remove();

        const nodesData = graphData.nodes || [];
        const edgesData = graphData.edges || [];
        if (nodesData.length === 0) return;

        const nodeMap = {};
        nodesData.forEach(n => nodeMap[n.uuid] = n);

        const nodes = nodesData.map(n => ({
            id: n.uuid,
            name: n.name || 'Unnamed',
            type: n.labels?.find(l => l !== 'Entity') || 'Entity',
            rawData: n
        }));
        const nodeIds = new Set(nodes.map(n => n.id));

        const edgePairCount = {};
        const selfLoopEdges = {};
        const tempEdges = edgesData.filter(e => nodeIds.has(e.source_node_uuid) && nodeIds.has(e.target_node_uuid));

        tempEdges.forEach(e => {
            if (e.source_node_uuid === e.target_node_uuid) {
                if (!selfLoopEdges[e.source_node_uuid]) selfLoopEdges[e.source_node_uuid] = [];
                selfLoopEdges[e.source_node_uuid].push({
                    ...e,
                    source_name: nodeMap[e.source_node_uuid]?.name,
                    target_name: nodeMap[e.target_node_uuid]?.name
                });
            } else {
                const pairKey = [e.source_node_uuid, e.target_node_uuid].sort().join('_');
                edgePairCount[pairKey] = (edgePairCount[pairKey] || 0) + 1;
            }
        });

        const edgePairIndex = {};
        const processedSelfLoopNodes = new Set();
        const edges = [];

        tempEdges.forEach(e => {
            const isSelfLoop = e.source_node_uuid === e.target_node_uuid;
            if (isSelfLoop) {
                if (processedSelfLoopNodes.has(e.source_node_uuid)) return;
                processedSelfLoopNodes.add(e.source_node_uuid);
                const allSelfLoops = selfLoopEdges[e.source_node_uuid];
                const nodeName = nodeMap[e.source_node_uuid]?.name || 'Unknown';

                edges.push({
                    source: e.source_node_uuid, target: e.target_node_uuid,
                    type: 'SELF_LOOP', name: `Self Relations (${allSelfLoops.length})`,
                    curvature: 0, isSelfLoop: true,
                    rawData: {
                        isSelfLoopGroup: true, source_name: nodeName, target_name: nodeName,
                        selfLoopCount: allSelfLoops.length, selfLoopEdges: allSelfLoops
                    }
                });
                return;
            }

            const pairKey = [e.source_node_uuid, e.target_node_uuid].sort().join('_');
            const totalCount = edgePairCount[pairKey];
            const currentIndex = edgePairIndex[pairKey] || 0;
            edgePairIndex[pairKey] = currentIndex + 1;

            const isReversed = e.source_node_uuid > e.target_node_uuid;
            let curvature = 0;
            if (totalCount > 1) {
                const curvatureRange = Math.min(1.2, 0.6 + totalCount * 0.15);
                curvature = ((currentIndex / (totalCount - 1)) - 0.5) * curvatureRange * 2;
                if (isReversed) curvature = -curvature;
            }

            edges.push({
                source: e.source_node_uuid, target: e.target_node_uuid,
                type: e.fact_type || e.name || 'RELATED', name: e.name || e.fact_type || 'RELATED',
                curvature, isSelfLoop: false, pairIndex: currentIndex, pairTotal: totalCount,
                rawData: {
                    ...e, source_name: nodeMap[e.source_node_uuid]?.name, target_name: nodeMap[e.target_node_uuid]?.name
                }
            });
        });

        const colorMap = {};
        entityTypes.forEach(t => colorMap[t.name] = t.color);
        const getColor = (type) => colorMap[type] || '#999';

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(d => {
                const baseDistance = 150;
                const edgeCount = d.pairTotal || 1;
                return baseDistance + (edgeCount - 1) * 50;
            }))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(50))
            .force('x', d3.forceX(width / 2).strength(0.04))
            .force('y', d3.forceY(height / 2).strength(0.04));

        d3Refs.current.currentSimulation = simulation;

        const g = svg.append('g');
        svg.call(d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([0.1, 4]).on('zoom', (event) => {
            g.attr('transform', event.transform);
        }));

        const linkGroup = g.append('g').attr('class', 'links');

        const getLinkPath = (d) => {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            if (d.isSelfLoop) {
                const loopRadius = 30;
                return `M${sx + 8},${sy - 4} A${loopRadius},${loopRadius} 0 1,1 ${sx + 8},${sy + 4}`;
            }
            if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`;

            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pairTotal = d.pairTotal || 1;
            const offsetRatio = 0.25 + pairTotal * 0.05;
            const baseOffset = Math.max(35, dist * offsetRatio);
            const offsetX = -dy / dist * d.curvature * baseOffset;
            const offsetY = dx / dist * d.curvature * baseOffset;
            const cx = (sx + tx) / 2 + offsetX, cy = (sy + ty) / 2 + offsetY;
            return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        };

        const getLinkMidpoint = (d) => {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            if (d.isSelfLoop) return { x: sx + 70, y: sy };
            if (d.curvature === 0) return { x: (sx + tx) / 2, y: (sy + ty) / 2 };

            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pairTotal = d.pairTotal || 1;
            const offsetRatio = 0.25 + pairTotal * 0.05;
            const baseOffset = Math.max(35, dist * offsetRatio);
            const offsetX = -dy / dist * d.curvature * baseOffset;
            const offsetY = dx / dist * d.curvature * baseOffset;
            const cx = (sx + tx) / 2 + offsetX, cy = (sy + ty) / 2 + offsetY;

            return {
                x: 0.25 * sx + 0.5 * cx + 0.25 * tx,
                y: 0.25 * sy + 0.5 * cy + 0.25 * ty
            };
        };

        const link = linkGroup.selectAll('path')
            .data(edges).enter().append('path')
            .attr('stroke', '#C0C0C0')
            .attr('stroke-width', 1.5)
            .attr('fill', 'none')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                linkGroup.selectAll('path').attr('stroke', '#C0C0C0').attr('stroke-width', 1.5);
                d3Refs.current.linkLabelBg.attr('fill', 'rgba(255,255,255,0.95)');
                d3Refs.current.linkLabels.attr('fill', '#666');
                d3.select(event.target).attr('stroke', '#3498db').attr('stroke-width', 3);
                setSelectedItem({ type: 'edge', data: d.rawData });
            });

        const linkLabelBg = linkGroup.selectAll('rect')
            .data(edges).enter().append('rect')
            .attr('fill', 'rgba(255,255,255,0.95)')
            .attr('rx', 3).attr('ry', 3)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .style('display', showEdgeLabels ? 'block' : 'none')
            .on('click', (event, d) => {
                event.stopPropagation();
                linkGroup.selectAll('path').attr('stroke', '#C0C0C0').attr('stroke-width', 1.5);
                linkLabelBg.attr('fill', 'rgba(255,255,255,0.95)');
                linkLabels.attr('fill', '#666');
                link.filter(l => l === d).attr('stroke', '#3498db').attr('stroke-width', 3);
                d3.select(event.target).attr('fill', 'rgba(52, 152, 219, 0.1)');
                setSelectedItem({ type: 'edge', data: d.rawData });
            });

        const linkLabels = linkGroup.selectAll('text')
            .data(edges).enter().append('text')
            .text(d => d.name)
            .attr('font-size', '9px')
            .attr('fill', '#666')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .style('font-family', 'system-ui, sans-serif')
            .style('display', showEdgeLabels ? 'block' : 'none')
            .on('click', (event, d) => {
                event.stopPropagation();
                linkGroup.selectAll('path').attr('stroke', '#C0C0C0').attr('stroke-width', 1.5);
                linkLabelBg.attr('fill', 'rgba(255,255,255,0.95)');
                linkLabels.attr('fill', '#666');
                link.filter(l => l === d).attr('stroke', '#3498db').attr('stroke-width', 3);
                d3.select(event.target).attr('fill', '#3498db');
                setSelectedItem({ type: 'edge', data: d.rawData });
            });

        d3Refs.current.linkLabels = linkLabels;
        d3Refs.current.linkLabelBg = linkLabelBg;

        const nodeGroup = g.append('g').attr('class', 'nodes');
        const node = nodeGroup.selectAll('circle')
            .data(nodes).enter().append('circle')
            .attr('r', 10).attr('fill', d => getColor(d.type))
            .attr('stroke', '#fff').attr('stroke-width', 2.5)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => {
                    d.fx = d.x; d.fy = d.y;
                    d._dragStartX = event.x; d._dragStartY = event.y;
                    d._isDragging = false;
                })
                .on('drag', (event, d) => {
                    const dx = event.x - d._dragStartX;
                    const dy = event.y - d._dragStartY;
                    if (!d._isDragging && Math.sqrt(dx * dx + dy * dy) > 3) {
                        d._isDragging = true;
                        simulation.alphaTarget(0.3).restart();
                    }
                    if (d._isDragging) {
                        d.fx = event.x; d.fy = event.y;
                    }
                })
                .on('end', (event, d) => {
                    if (d._isDragging) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                    d._isDragging = false;
                })
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                node.attr('stroke', '#fff').attr('stroke-width', 2.5);
                linkGroup.selectAll('path').attr('stroke', '#C0C0C0').attr('stroke-width', 1.5);
                d3.select(event.target).attr('stroke', '#E91E63').attr('stroke-width', 4);
                link.filter(l => l.source.id === d.id || l.target.id === d.id)
                    .attr('stroke', '#E91E63').attr('stroke-width', 2.5);

                setSelectedItem({ type: 'node', data: d.rawData, entityType: d.type, color: getColor(d.type) });
            })
            .on('mouseenter', (event, d) => {
                if (!selectedItem || selectedItem.data?.uuid !== d.rawData.uuid) {
                    d3.select(event.target).attr('stroke', '#333').attr('stroke-width', 3);
                }
            })
            .on('mouseleave', (event, d) => {
                if (!selectedItem || selectedItem.data?.uuid !== d.rawData.uuid) {
                    d3.select(event.target).attr('stroke', '#fff').attr('stroke-width', 2.5);
                }
            });

        const nodeLabels = nodeGroup.selectAll('text')
            .data(nodes).enter().append('text')
            .text(d => d.name.length > 8 ? d.name.substring(0, 8) + '…' : d.name)
            .attr('font-size', '11px').attr('fill', '#333').attr('font-weight', '500')
            .attr('dx', 14).attr('dy', 4)
            .style('pointer-events', 'none').style('font-family', 'system-ui, sans-serif');

        simulation.on('tick', () => {
            link.attr('d', getLinkPath);
            linkLabels.each(function (d) {
                const mid = getLinkMidpoint(d);
                d3.select(this).attr('x', mid.x).attr('y', mid.y);
            });
            linkLabelBg.each(function (d, i) {
                const mid = getLinkMidpoint(d);
                const textEl = linkLabels.nodes()[i];
                const bbox = textEl.getBBox();
                d3.select(this)
                    .attr('x', mid.x - bbox.width / 2 - 4)
                    .attr('y', mid.y - bbox.height / 2 - 2)
                    .attr('width', bbox.width + 8)
                    .attr('height', bbox.height + 4);
            });
            node.attr('cx', d => d.x).attr('cy', d => d.y);
            nodeLabels.attr('x', d => d.x).attr('y', d => d.y);
        });

        svg.on('click', () => {
            setSelectedItem(null);
            node.attr('stroke', '#fff').attr('stroke-width', 2.5);
            linkGroup.selectAll('path').attr('stroke', '#C0C0C0').attr('stroke-width', 1.5);
            if (d3Refs.current.linkLabelBg) d3Refs.current.linkLabelBg.attr('fill', 'rgba(255,255,255,0.95)');
            if (d3Refs.current.linkLabels) d3Refs.current.linkLabels.attr('fill', '#666');
        });

    }, [graphData, entityTypes, showEdgeLabels]);

    useEffect(() => {
        if (d3Refs.current.linkLabels) d3Refs.current.linkLabels.style('display', showEdgeLabels ? 'block' : 'none');
        if (d3Refs.current.linkLabelBg) d3Refs.current.linkLabelBg.style('display', showEdgeLabels ? 'block' : 'none');
    }, [showEdgeLabels]);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            if (!graphSvgRef.current || !graphContainerRef.current || !d3Refs.current.currentSimulation) return;
            const width = graphContainerRef.current.clientWidth;
            const height = graphContainerRef.current.clientHeight;
            d3.select(graphSvgRef.current).attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
            d3Refs.current.currentSimulation.force('center', d3.forceCenter(width / 2, height / 2))
                .force('x', d3.forceX(width / 2).strength(0.04))
                .force('y', d3.forceY(height / 2).strength(0.04))
                .alpha(0.3).restart();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="graph-panel">
            <div className="panel-header">
                <span className="panel-title">Graph Relationship Visualization</span>
                <div className="header-tools">
                    <button className="tool-btn" onClick={onRefresh} disabled={loading} title="刷新图谱">
                        <span className={`icon-refresh ${loading ? 'spinning' : ''}`}>↻</span>
                        <span className="btn-text">Refresh</span>
                    </button>
                    <button className="tool-btn" onClick={onToggleMaximize} title="最大化/还原">
                        <span className="icon-maximize">⛶</span>
                    </button>
                </div>
            </div>

            <div className="graph-container" ref={graphContainerRef}>
                {graphData ? (
                    <div className="graph-view">
                        <svg ref={graphSvgRef} className="graph-svg"></svg>

                        {(currentPhase === 1 || isSimulating) && (
                            <div className="graph-building-hint">
                                <div className="memory-icon-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="memory-icon">
                                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-4.04z" />
                                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-4.04z" />
                                    </svg>
                                </div>
                                {isSimulating ? 'GraphRAG长短期记忆实时更新中' : '实时更新中...'}
                            </div>
                        )}

                        {showSimulationFinishedHint && (
                            <div className="graph-building-hint finished-hint">
                                <div className="hint-icon-wrapper">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hint-icon">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                </div>
                                <span className="hint-text">还有少量内容处理中，建议稍后手动刷新图谱</span>
                                <button className="hint-close-btn" onClick={dismissFinishedHint} title="关闭提示">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        )}

                        {selectedItem && (
                            <div className="detail-panel">
                                <div className="detail-panel-header">
                                    <span className="detail-title">{selectedItem.type === 'node' ? 'Node Details' : 'Relationship'}</span>
                                    {selectedItem.type === 'node' && (
                                        <span className="detail-type-badge" style={{ background: selectedItem.color, color: '#fff' }}>
                                            {selectedItem.entityType}
                                        </span>
                                    )}
                                    <button className="detail-close" onClick={closeDetailPanel}>×</button>
                                </div>

                                {selectedItem.type === 'node' ? (
                                    <div className="detail-content">
                                        <div className="detail-row">
                                            <span className="detail-label">Name:</span>
                                            <span className="detail-value">{selectedItem.data.name}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">UUID:</span>
                                            <span className="detail-value uuid-text">{selectedItem.data.uuid}</span>
                                        </div>
                                        {selectedItem.data.created_at && (
                                            <div className="detail-row">
                                                <span className="detail-label">Created:</span>
                                                <span className="detail-value">{formatDateTime(selectedItem.data.created_at)}</span>
                                            </div>
                                        )}

                                        {selectedItem.data.attributes && Object.keys(selectedItem.data.attributes).length > 0 && (
                                            <div className="detail-section">
                                                <div className="section-title">Properties:</div>
                                                <div className="properties-list">
                                                    {Object.entries(selectedItem.data.attributes).map(([key, value]) => (
                                                        <div key={key} className="property-item">
                                                            <span className="property-key">{key}:</span>
                                                            <span className="property-value">{value || 'None'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedItem.data.summary && (
                                            <div className="detail-section">
                                                <div className="section-title">Summary:</div>
                                                <div className="summary-text">{selectedItem.data.summary}</div>
                                            </div>
                                        )}

                                        {selectedItem.data.labels?.length > 0 && (
                                            <div className="detail-section">
                                                <div className="section-title">Labels:</div>
                                                <div className="labels-list">
                                                    {selectedItem.data.labels.map(label => (
                                                        <span key={label} className="label-tag">{label}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="detail-content">
                                        {selectedItem.data.isSelfLoopGroup ? (
                                            <>
                                                <div className="edge-relation-header self-loop-header">
                                                    {selectedItem.data.source_name} - Self Relations
                                                    <span className="self-loop-count">{selectedItem.data.selfLoopCount} items</span>
                                                </div>
                                                <div className="self-loop-list">
                                                    {selectedItem.data.selfLoopEdges?.map((loop, idx) => {
                                                        const loopId = loop.uuid || idx;
                                                        const isExpanded = expandedSelfLoops.has(loopId);
                                                        return (
                                                            <div key={loopId} className={`self-loop-item ${isExpanded ? 'expanded' : ''}`}>
                                                                <div className="self-loop-item-header" onClick={() => toggleSelfLoop(loopId)}>
                                                                    <span className="self-loop-index">#{idx + 1}</span>
                                                                    <span className="self-loop-name">{loop.name || loop.fact_type || 'RELATED'}</span>
                                                                    <span className="self-loop-toggle">{isExpanded ? '−' : '+'}</span>
                                                                </div>
                                                                {isExpanded && (
                                                                    <div className="self-loop-item-content">
                                                                        {loop.uuid && <div className="detail-row"><span className="detail-label">UUID:</span><span className="detail-value uuid-text">{loop.uuid}</span></div>}
                                                                        {loop.fact && <div className="detail-row"><span className="detail-label">Fact:</span><span className="detail-value fact-text">{loop.fact}</span></div>}
                                                                        {loop.fact_type && <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">{loop.fact_type}</span></div>}
                                                                        {loop.created_at && <div className="detail-row"><span className="detail-label">Created:</span><span className="detail-value">{formatDateTime(loop.created_at)}</span></div>}
                                                                        {loop.episodes?.length > 0 && (
                                                                            <div className="self-loop-episodes">
                                                                                <span className="detail-label">Episodes:</span>
                                                                                <div className="episodes-list compact">
                                                                                    {loop.episodes.map(ep => <span key={ep} className="episode-tag small">{ep}</span>)}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="edge-relation-header">
                                                    {selectedItem.data.source_name} → {selectedItem.data.name || 'RELATED_TO'} → {selectedItem.data.target_name}
                                                </div>
                                                <div className="detail-row"><span className="detail-label">UUID:</span><span className="detail-value uuid-text">{selectedItem.data.uuid}</span></div>
                                                <div className="detail-row"><span className="detail-label">Label:</span><span className="detail-value">{selectedItem.data.name || 'RELATED_TO'}</span></div>
                                                <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">{selectedItem.data.fact_type || 'Unknown'}</span></div>
                                                {selectedItem.data.fact && <div className="detail-row"><span className="detail-label">Fact:</span><span className="detail-value fact-text">{selectedItem.data.fact}</span></div>}
                                                {selectedItem.data.episodes?.length > 0 && (
                                                    <div className="detail-section">
                                                        <div className="section-title">Episodes:</div>
                                                        <div className="episodes-list">
                                                            {selectedItem.data.episodes.map(ep => <span key={ep} className="episode-tag">{ep}</span>)}
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedItem.data.created_at && <div className="detail-row"><span className="detail-label">Created:</span><span className="detail-value">{formatDateTime(selectedItem.data.created_at)}</span></div>}
                                                {selectedItem.data.valid_at && <div className="detail-row"><span className="detail-label">Valid From:</span><span className="detail-value">{formatDateTime(selectedItem.data.valid_at)}</span></div>}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : loading ? (
                    <div className="graph-state">
                        <div className="loading-spinner"></div>
                        <p>图谱数据加载中...</p>
                    </div>
                ) : (
                    <div className="graph-state">
                        <div className="empty-icon">❖</div>
                        <p className="empty-text">等待本体生成...</p>
                    </div>
                )}
            </div>

            {graphData && entityTypes.length > 0 && (
                <div className="graph-legend">
                    <span className="legend-title">Entity Types</span>
                    <div className="legend-items">
                        {entityTypes.map(type => (
                            <div key={type.name} className="legend-item">
                                <span className="legend-dot" style={{ background: type.color }}></span>
                                <span className="legend-label">{type.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {graphData && (
                <div className="edge-labels-toggle">
                    <label className="toggle-switch">
                        <input type="checkbox" checked={showEdgeLabels} onChange={e => setShowEdgeLabels(e.target.checked)} />
                        <span className="slider"></span>
                    </label>
                    <span className="toggle-label">Show Edge Labels</span>
                </div>
            )}
        </div>
    );
};

export default React.memo(GraphPanel);
