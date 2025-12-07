import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { KnowledgeSheet, GraphNode, GraphEdge } from '../../types';

// Physics constants
const REPULSION_STRENGTH = -800;
const LINK_STRENGTH = 0.08;
const CENTER_FORCE_STRENGTH = 0.01;
const DAMPING = 0.95;
const NODE_RADIUS = 12;

interface KnowledgeGraphProps {
    sheets: KnowledgeSheet[];
    onNodeClick: (sheetId: string) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ sheets, onNodeClick }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    
    const [viewBox, setViewBox] = useState({ x: -500, y: -500, w: 1000, h: 1000 });
    const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const neighbors = useMemo(() => {
        if (!hoveredNodeId) return new Set();
        const connected = new Set([hoveredNodeId]);
        edges.forEach(edge => {
            if (edge.source === hoveredNodeId) connected.add(edge.target);
            if (edge.target === hoveredNodeId) connected.add(edge.source);
        });
        return connected;
    }, [hoveredNodeId, edges]);

    // Parse sheets into nodes and edges
    useEffect(() => {
        const sheetMap = new Map<string, KnowledgeSheet>(sheets.map(s => [s.name.trim().toLowerCase(), s]));
        const newEdges: GraphEdge[] = [];
        const linkedIds = new Set<string>();

        sheets.forEach(sheet => {
            const linkRegex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = linkRegex.exec(sheet.content)) !== null) {
                const linkName = match[1].trim().toLowerCase();
                const targetSheet = sheetMap.get(linkName);
                if (targetSheet && targetSheet.id !== sheet.id) {
                    newEdges.push({ source: sheet.id, target: targetSheet.id });
                    linkedIds.add(sheet.id);
                    linkedIds.add(targetSheet.id);
                }
            }
        });
        
        setEdges(newEdges);
        setNodes(sheets.map(sheet => ({
            id: sheet.id,
            name: sheet.name,
            category: sheet.category,
            isOrphan: !linkedIds.has(sheet.id),
            x: Math.random() * 500 - 250,
            y: Math.random() * 500 - 250,
            vx: 0,
            vy: 0,
        })));
    }, [sheets]);

    // Physics simulation loop
    useEffect(() => {
        let animationFrameId: number;
        const tick = () => {
            setNodes(currentNodes => {
                const newNodes: GraphNode[] = currentNodes.map(n => ({ ...n }));
                const nodeMap = new Map(newNodes.map(n => [n.id, n]));

                // Apply forces
                for (let i = 0; i < newNodes.length; i++) {
                    const nodeA = newNodes[i];

                    // Repulsion from other nodes
                    for (let j = i + 1; j < newNodes.length; j++) {
                        const nodeB = newNodes[j];
                        const dx = nodeB.x - nodeA.x;
                        const dy = nodeB.y - nodeA.y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = REPULSION_STRENGTH / (distance * distance);
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        nodeA.vx += fx;
                        nodeA.vy += fy;
                        nodeB.vx -= fx;
                        nodeB.vy -= fy;
                    }
                    
                    // Center gravity
                    const centerDx = -nodeA.x;
                    const centerDy = -nodeA.y;
                    nodeA.vx += centerDx * CENTER_FORCE_STRENGTH;
                    nodeA.vy += centerDy * CENTER_FORCE_STRENGTH;
                }

                // Link attraction
                for (const edge of edges) {
                    const source = nodeMap.get(edge.source) as GraphNode | undefined;
                    const target = nodeMap.get(edge.target) as GraphNode | undefined;
                    if (source && target) {
                        const dx = target.x - source.x;
                        const dy = target.y - source.y;
                        source.vx += dx * LINK_STRENGTH;
                        source.vy += dy * LINK_STRENGTH;
                        target.vx -= dx * LINK_STRENGTH;
                        target.vy -= dy * LINK_STRENGTH;
                    }
                }

                // Update positions
                for (const node of newNodes) {
                    if (node.id === isDraggingNode) continue;
                    node.vx *= DAMPING;
                    node.vy *= DAMPING;
                    node.x += node.vx;
                    node.y += node.vy;
                }
                return newNodes;
            });
            animationFrameId = requestAnimationFrame(tick);
        };
        animationFrameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animationFrameId);
    }, [edges, isDraggingNode]);

    const getSVGPoint = (e: React.MouseEvent): { x: number; y: number } => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const screenCTM = svgRef.current.getScreenCTM();
        return screenCTM ? pt.matrixTransform(screenCTM.inverse()) : pt;
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleFactor = 1.1;
        const { x, y } = getSVGPoint(e);
        const { w, h } = viewBox;
        const newW = e.deltaY > 0 ? w * scaleFactor : w / scaleFactor;
        const newH = e.deltaY > 0 ? h * scaleFactor : h / scaleFactor;

        setViewBox({
            x: x - (x - viewBox.x) * (newW / w),
            y: y - (y - viewBox.y) * (newH / h),
            w: newW,
            h: newH,
        });
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === svgRef.current) {
            setIsPanning(true);
            setPanStart(getSVGPoint(e));
        }
    };
    
    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        setIsDraggingNode(nodeId);
        setPanStart(getSVGPoint(e));
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning && !isDraggingNode) return;
        const point = getSVGPoint(e);
        const dx = point.x - panStart.x;
        const dy = point.y - panStart.y;
        
        if (isPanning) {
            setViewBox(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
        } else if (isDraggingNode) {
            setNodes(nodes => nodes.map(n => n.id === isDraggingNode ? { ...n, x: n.x + dx, y: n.y + dy, vx: 0, vy: 0 } : n));
            setPanStart(point);
        }
    };

    const handleMouseUp = () => {
        setIsDraggingNode(null);
        setIsPanning(false);
    };

    return (
        <div className="flex-grow bg-zinc-50 dark:bg-zinc-900 overflow-hidden cursor-grab active:cursor-grabbing">
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <defs>
                    <style>{`
                        .node-text {
                            font-size: 5px;
                            paint-order: stroke;
                            stroke: #ffffff;
                            stroke-width: 1.5px;
                            stroke-linecap: butt;
                            stroke-linejoin: miter;
                            fill: #18181b;
                        }
                        .dark .node-text {
                             stroke: #27272a;
                             fill: #f4f4f5;
                        }
                    `}</style>
                </defs>
                <g>
                    {edges.map(({ source, target }, i) => {
                        const sourceNode = nodes.find(n => n.id === source);
                        const targetNode = nodes.find(n => n.id === target);
                        if (!sourceNode || !targetNode) return null;
                        const isHovered = (hoveredNodeId === source || hoveredNodeId === target);
                        return (
                            <line
                                key={`${source}-${target}-${i}`}
                                x1={sourceNode.x} y1={sourceNode.y}
                                x2={targetNode.x} y2={targetNode.y}
                                stroke={isHovered ? "#4f46e5" : "#d4d4d8"}
                                className="dark:stroke-zinc-600 dark:group-hover:stroke-indigo-400 transition-all"
                                strokeWidth={isHovered ? 1.5 : 0.5}
                                opacity={hoveredNodeId && !isHovered ? 0.2 : 1}
                            />
                        );
                    })}
                </g>
                <g>
                    {nodes.map(node => (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                            onClick={() => onNodeClick(node.id)}
                            onMouseEnter={() => setHoveredNodeId(node.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                            className="cursor-pointer group"
                        >
                            <circle
                                r={NODE_RADIUS}
                                fill={neighbors.has(node.id) ? "#818cf8" : "#f4f4f5"}
                                stroke={neighbors.has(node.id) ? "#4f46e5" : "#a1a1aa"}
                                strokeWidth={hoveredNodeId === node.id ? 2 : (node.isOrphan ? 1 : 0.5)}
                                strokeDasharray={node.isOrphan ? "2 2" : "none"}
                                opacity={hoveredNodeId && !neighbors.has(node.id) ? 0.3 : 1}
                                className="dark:fill-zinc-700 dark:stroke-zinc-500 dark:group-hover:stroke-indigo-400 transition-all duration-200"
                            />
                            <text
                                textAnchor="middle"
                                y={NODE_RADIUS + 7}
                                className="node-text select-none"
                                opacity={hoveredNodeId && !neighbors.has(node.id) ? 0.3 : 1}
                            >
                                {node.name}
                            </text>
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default KnowledgeGraph;