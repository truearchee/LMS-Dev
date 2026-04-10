"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

export interface AppNode extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  group: number;
  val: number;
  originalId?: string;
  nextNodeIds?: string[];
  floatSpeed: number;
  visualY?: number;
  lectureIndex?: number;
  shortLabel?: string;
}

export interface AppLink extends d3.SimulationLinkDatum<AppNode> {
  source: any;
  target: any;
  label?: string;
}

import {
  Settings,
  Search,
  Layers,
  Zap,
  Maximize2,
  RotateCcw,
  Plus,
  BookOpen,
  Compass,
  ChevronRight,
  Focus,
  X,
  Info,
  ExternalLink,
  GraduationCap,
  ArrowRight,
  Network,
  Eye,
  Wind,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* 1. DOT GRID LAYER (Now with Static Grid + Noise) */
/* -------------------------------------------------------------------------- */

const DotGridLayer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationId: number;

    // Physics Constants
    const DOT_SPACING = 40; // Matches CSS Grid background-size
    const DOT_SIZE = 1.5;
    const MOUSE_RADIUS = 120;
    const RETURN_SPEED = 0.05;
    const DISPLACE_STRENGTH = 0.15;

    let dots: any[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        initDots();
      }
    };

    const initDots = () => {
      dots = [];
      // Calculate offset to center the grid exactly like the CSS grid
      const cols = Math.ceil(canvas.width / DOT_SPACING);
      const rows = Math.ceil(canvas.height / DOT_SPACING);

      // Calculate start position to center the pattern
      const startX = (canvas.width % DOT_SPACING) / 2;
      const startY = (canvas.height % DOT_SPACING) / 2;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = startX + i * DOT_SPACING;
          const y = startY + j * DOT_SPACING;
          dots.push({ x, y, ox: x, oy: y, vx: 0, vy: 0 });
        }
      }
    };

    const animate = () => {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      dots.forEach((dot) => {
        const dx = mouseRef.current.x - dot.x;
        const dy = mouseRef.current.y - dot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * -1 * (DISPLACE_STRENGTH * 10);
          const moveY = Math.sin(angle) * force * -1 * (DISPLACE_STRENGTH * 10);
          dot.vx += moveX;
          dot.vy += moveY;
        }

        dot.x += (dot.ox - dot.x) * RETURN_SPEED;
        dot.y += (dot.oy - dot.y) * RETURN_SPEED;
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.vx *= 0.9;
        dot.vy *= 0.9;

        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, DOT_SIZE, 0, Math.PI * 2);

        // Dynamic Color: Purple glow on displacement
        const distFromOrigin = Math.sqrt(
          (dot.x - dot.ox) ** 2 + (dot.y - dot.oy) ** 2,
        );
        if (distFromOrigin > 1) {
          ctx!.fillStyle = `rgba(82, 39, 255, ${Math.min(distFromOrigin / 15, 0.5)})`;
        } else {
          ctx!.fillStyle = "rgba(255, 255, 255, 0.15)";
        }
        ctx!.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => resize());
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    const handleMouseMove = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("mousemove", handleMouseMove);

    resize();
    animate();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none bg-[#050505] overflow-hidden">
      {/* 1. STATIC GRID PATTERN (The "Lattice") */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
                    linear-gradient(to right, #333 1px, transparent 1px),
                    linear-gradient(to bottom, #333 1px, transparent 1px)
                `,
          backgroundSize: "40px 40px", // Matches DOT_SPACING
          backgroundPosition: "center", // Aligns with dots calculation
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 100%)", // Fade edges
        }}
      />

      {/* 2. NOISE TEXTURE (Premium Feel) */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 3. INTERACTIVE DOTS CANVAS */}
      <canvas ref={canvasRef} className="w-full h-full relative z-10" />

      {/* 4. VIGNETTE OVERLAY */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_90%)] opacity-80 z-20" />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. GRAPH DATA                               */
/* -------------------------------------------------------------------------- */

const enrich = (n: any): AppNode => ({
  ...n,
  floatPhase: Math.random() * Math.PI * 2,
  floatSpeed: 0.5 + Math.random() * 0.5,
});

/* -------------------------------------------------------------------------- */
/* 3. MAIN COMPONENT                           */
/* -------------------------------------------------------------------------- */

export default function GraphView() {
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [links, setLinks] = useState<AppLink[]>([]);
  const [activeNode, setActiveNode] = useState<AppNode | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/v1/courses/calc-101/graph')
      .then(res => res.json())
      .then(data => {
        if (!data || !data.nodes) return;

        // 1. HUB Node (Course)
        const hub = enrich({ id: data.title, type: 'hub', group: 1, val: 30 });
        
        // 2. Satellite Nodes
        const sats = data.nodes.map((n: any, idx: number) => {
           const type = n.type;
           const group = type === 'LECTURE' ? 2 : type === 'QUIZ' ? 3 : 4;
           const val = type === 'LECTURE' ? 18 : type === 'QUIZ' ? 24 : 10;
           const lectureIndex = type === 'LECTURE' ? parseInt(n.title.replace('Lecture ', '')) : undefined;
           
           let shortLabel = type === 'LECTURE' 
             ? `${lectureIndex}` 
             : type === 'QUIZ' ? n.title.replace('Quiz ', 'Q') : n.title.replace('Assignment ', 'A');

           return enrich({
             id: n.title,
             type,
             group,
             val,
             originalId: n.id,
             nextNodeIds: n.nextNodeIds,
             lectureIndex,
             shortLabel
           });
        });

        const finalNodes = [hub, ...sats];
        
        // 3. Links
        const finalLinks: AppLink[] = [];
        
        // Connect Hub to LECTURES ONLY (Solar System mode constraint)
        sats.forEach((s: AppNode) => {
           if (s.type === 'LECTURE') {
               finalLinks.push({ source: hub.id, target: s.id });
           }
        });

        // Identify paths between satellites
        const idMap = new Map();
        sats.forEach((s: AppNode) => idMap.set(s.originalId, s.id));

        sats.forEach((s: AppNode) => {
           if (s.nextNodeIds && s.nextNodeIds.length > 0) {
              s.nextNodeIds!.forEach((nId: string) => {
                 const targetName = idMap.get(nId);
                 if (targetName) {
                    finalLinks.push({ source: s.id, target: targetName });
                 }
              });
           }
        });

        setNodes(finalNodes);
        setLinks(finalLinks);
      })
      .catch(err => console.error("Error fetching graph data:", err));
  }, []);

  // Settings
  const [repulsion, setRepulsion] = useState(-800);
  const [gravity, setGravity] = useState(0.1);
  const [floatIntensity, setFloatIntensity] = useState(5);
  const [labelThreshold, setLabelThreshold] = useState(1.0);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Refs
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<d3.Simulation<AppNode, AppLink> | null>(null);
  const zoomRef = useRef<any>(null);
  const gRef = useRef<any>(null);
  const currentScaleRef = useRef(0.6);
  const labelThresholdRef = useRef(1.0);

  // Ref for the render loop to access latest state without re-binding
  const floatIntensityRef = useRef(5);

  // O(1) Lookup
  const neighborMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, new Set()));
    links.forEach((l: any) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (map.has(s)) map.get(s).add(t);
      if (map.has(t)) map.get(t).add(s);
    });
    return map;
  }, [nodes, links]);

  // Sync settings to refs
  useEffect(() => {
    labelThresholdRef.current = labelThreshold;
    if (gRef.current) updateLabels();
  }, [labelThreshold]);

  useEffect(() => {
    floatIntensityRef.current = floatIntensity;
  }, [floatIntensity]);

  const COLORS = [
    "#FF3B30",
    "#30D158",
    "#0A84FF",
    "#BF5AF2",
    "#FF9F0A",
    "#64D2FF",
  ];
  const getColor = (group: number) => COLORS[group] || "#8E8E93";

  // Label Visibility Logic
  const getNodeVisibilityThreshold = (d: any) => {
    let factor = 1.0;
    if (d.val >= 20) factor = 0.3;
    else if (d.val >= 10) factor = 0.6;
    return labelThresholdRef.current * factor;
  };

  const updateLabels = () => {
    if (!gRef.current) return;
    gRef.current
      .selectAll("text")
      .transition()
      .duration(200)
      .style("opacity", function (this: any, d: any) {
        const parent = d3.select(this.parentNode);
        if (parent.classed("node-hovered") || parent.classed("node-active"))
          return 1;
        const threshold = getNodeVisibilityThreshold(d);
        return currentScaleRef.current < threshold ? 0 : 0.8;
      });
  };

  // --- RESIZE OBSERVER ---
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (svgRef.current)
            d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]);
          if (simulationRef.current) {
            simulationRef.current.force(
              "center",
              d3.forceCenter(width / 2, height / 2),
            );
            simulationRef.current.alpha(0.3).restart();
          }
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- D3 SETUP & RENDER LOOP ---
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3
      .select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    const shadowFilter = defs
      .append("filter")
      .attr("id", "drop-shadow")
      .attr("height", "130%");
    shadowFilter
      .append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 2)
      .attr("result", "blur");
    shadowFilter
      .append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 2)
      .attr("result", "offsetBlur");
    const feMerge = shadowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 24)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "rgba(255,255,255,0.3)");

    COLORS.forEach((color, i) => {
      defs
        .append("marker")
        .attr("id", `arrow-colored-${i}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 24)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);

      const grad = defs
        .append("radialGradient")
        .attr("id", `glow-grad-${i}`)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");
      grad
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0.3);
      grad
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color)
        .attr("stop-opacity", 0);
    });

    const g = svg.append("g").attr("class", "graph-container");
    gRef.current = g;

    // --- CSS STYLES ---
    // Removed the .node-inner-content animation block because we do it in JS now
    svg.append("style").text(`
      .graph-container { transition: opacity 0.5s ease; }
      
      /* FOCUS MODE */
      .graph-container.in-focus-mode .node-group:not(.node-active) { opacity: 0.2; filter: blur(3px); transition: opacity 0.5s, filter 0.5s; }
      .graph-container.in-focus-mode .visible-link:not(.link-active) { stroke-opacity: 0.05; transition: stroke-opacity 0.5s; }

      /* HIGHLIGHTS */
      .node-group.node-active, .node-group.node-hovered { opacity: 1; filter: url(#drop-shadow); }
      .visible-link.link-active, .visible-link.link-hovered { stroke-opacity: 1; stroke-width: 2px; }
      
      /* POP ANIMATION */
      .node-glow { transition: r 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); } 
      .node-core { transition: r 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
    `);

    // Zoom
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        currentScaleRef.current = event.transform.k;
        updateLabels();
      });
    svg
      .call(zoom as any)
      .call(
        zoom.transform as any,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(0.6),
      );
    zoomRef.current = zoom;

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance((d: any) => {
             // Hub -> Lecture dynamic spiral scaling
             if (d.source.type === 'hub') {
                 const idx = d.target.lectureIndex || 1;
                 return 100 + (idx * 25);
             }
             // Lecture -> Assessment tight grouping
             return 40; 
          }),
      )
      .force("charge", d3.forceManyBody().strength(repulsion))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => d.val * 2)
          .iterations(2),
      )
      .force("x", d3.forceX(width / 2).strength(gravity))
      .force("y", d3.forceY(height / 2).strength(gravity));

    simulation.alphaDecay(0.02);
    simulationRef.current = simulation;

    // --- ELEMENTS ---
    const linkHitArea = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "transparent")
      .attr("stroke-width", 20)
      .style("cursor", "pointer")
      .on("click", (e: any) => {
        e.stopPropagation();
        setActiveNode(null);
      });

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "visible-link")
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrow)");

    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer");

    // Inner group for Pop animation scaling
    const nodeContent = node.append("g").attr("class", "node-inner-content");

    nodeContent
      .append("circle")
      .attr("class", "node-glow")
      .attr("r", (d: any) => d.val + 10)
      .attr("fill", (d: any) => `url(#glow-grad-${d.group % 6})`);
    nodeContent
      .append("circle")
      .attr("class", "node-core")
      .attr("r", (d: any) => d.val + 2)
      .attr("fill", (d: any) => {
          if (d.type === 'LECTURE') return '#64748B'; // Solid gray
          if (d.type === 'ASSIGNMENT') return '#78350F'; // Dark brownish
          if (d.type === 'QUIZ') return getColor(d.group); // Bright color
          return getColor(d.group);
      })
      .attr("stroke", (d: any) => d.type === 'QUIZ' ? getColor(d.group) : "rgba(255,255,255,0.9)")
      .attr("stroke-width", 1.5);
    nodeContent
      .append("text")
      .text((d: any) => d.shortLabel || d.id)
      .attr("dx", (d: any) => d.val + 10)
      .attr("dy", 4)
      .attr("fill", "rgba(255,255,255,0.95)")
      .attr("font-size", (d: any) => `${Math.max(10, 8 + d.val / 2.2)}px`)
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .style("text-shadow", "0 4px 8px rgba(0,0,0,0.9)");

    // --- INTERACTIONS ---
    node.on("mouseenter", function (event: any, d: any) {
      if (activeNode) return;

      const group = d3.select(this);
      group.classed("node-hovered", true);

      const content = group.select(".node-inner-content");
      content.select(".node-glow").attr("r", d.val * 4.5);
      content.select(".node-core").attr("r", (d.val + 2) * 1.5);

      g.selectAll(".visible-link")
        .classed(
          "link-hovered",
          (l: any) => l.source.id === d.id || l.target.id === d.id,
        )
        .style("stroke", (l: any) => l.source.id === d.id || l.target.id === d.id
            ? getColor(l.source.group)
            : null,
        )
        .attr("marker-end", (l: any) => l.source.id === d.id || l.target.id === d.id
            ? `url(#arrow-colored-${l.source.group % 6})`
            : "url(#arrow)",
        );

      updateLabels();
    });

    node.on("mouseleave", function (event: any, d: any) {
      if (activeNode) return;

      const group = d3.select(this);
      group.classed("node-hovered", false);

      const content = group.select(".node-inner-content");
      content.select(".node-glow").attr("r", d.val + 10);
      content.select(".node-core").attr("r", d.val + 2);

      g.selectAll(".visible-link")
        .classed("link-hovered", false)
        .style("stroke", null)
        .attr("marker-end", "url(#arrow)");

      updateLabels();
    });

    node.on("click", (event: any, d: any) => {
      event.stopPropagation();
      setActiveNode(d);
      svg
        .transition()
        .duration(1000)
        .call(
          zoom.transform as any,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1.1)
            .translate(-d.x, -d.y),
        );
    });

    node.call((d3.drag() as any)
        .on("start", (e: any) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          e.subject.fx = e.subject.x;
          e.subject.fy = e.subject.y;
        })
        .on("drag", (e: any) => {
          e.subject.fx = e.x;
          e.subject.fy = e.y;
        })
        .on("end", (e: any) => {
          if (!e.active) simulation.alphaTarget(0);
          e.subject.fx = null;
          e.subject.fy = null;
        }),
    );

    // --- CUSTOM RENDER LOOP (The "Game Loop") ---
    // This decouples physics (layout) from visual animation (floating)
    // allowing arrows to sync perfectly with bobbing nodes.
    const ticker = d3.timer((elapsed) => {
      // 1. Get Float intensity from Ref
      const amp = floatIntensityRef.current;
      const time = elapsed / 1000; // Seconds

      // 2. Update Node Positions (Physics + Sine Wave)
      node.attr("transform", (d: any) => {
        const floatY = Math.sin(time * d.floatSpeed + d.floatPhase) * amp;
        // Store current visual Y for link calculation
        d.visualY = d.y + floatY;
        return `translate(${d.x},${d.visualY})`;
      });

      // 3. Update Link Positions (Using VISUAL Y)
      linkHitArea
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.visualY || d.source.y) // Fallback if init
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.visualY || d.target.y);

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.visualY || d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.visualY || d.target.y);
    });

    // We don't need simulation.on('tick') anymore because d3.timer handles it 60fps
    // BUT we need simulation to actually update d.x/d.y values
    // d3.forceSimulation updates node objects in place. We just read them in the timer.

    return () => {
      ticker.stop();
      simulation.stop();
    };
  }, [nodes, links, repulsion, gravity]); // Removed floatIntensity dependency to avoid re-init

  // --- FOCUS STATE ---
  useEffect(() => {
    if (!gRef.current) return;
    const g = gRef.current;

    g.selectAll(".node-group").style("opacity", null).style("filter", null);
    g.selectAll(".visible-link").style("stroke", null).attr("marker-end", null);

    if (!activeNode) {
      g.classed("in-focus-mode", false);
      g.selectAll(".node-group")
        .classed("node-active", false)
        .select(".node-inner-content")
        .select(".node-glow")
        .attr("r", (d: any) => d.val + 10);
      g.selectAll(".visible-link")
        .classed("link-active", false)
        .attr("marker-end", "url(#arrow)");
      return;
    }

    const neighbors = neighborMap.get(activeNode.id);
    g.classed("in-focus-mode", true);

    g.selectAll(".node-group").classed(
      "node-active",
      (n: any) => n.id === activeNode.id || neighbors.has(n.id),
    );

    g.selectAll(".visible-link")
      .classed(
        "link-active",
        (l: any) => l.source.id === activeNode.id || l.target.id === activeNode.id,
      )
      .style("stroke", (l: any) => l.source.id === activeNode.id || l.target.id === activeNode.id
          ? getColor(l.source.group)
          : null,
      )
      .attr("marker-end", (l: any) => l.source.id === activeNode.id || l.target.id === activeNode.id
          ? `url(#arrow-colored-${l.source.group % 6})`
          : "url(#arrow)",
      );

    g.selectAll(".node-group")
      .filter((d: any) => d.id === activeNode.id)
      .select(".node-inner-content")
      .select(".node-glow")
      .transition()
      .duration(600)
      .attr("r", activeNode.val * 4.5);
  }, [activeNode, neighborMap]);

  const resetView = () => {
    setActiveNode(null);
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(1000)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(0, 0).scale(0.6),
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] text-[#F5F5F7] font-sans overflow-hidden antialiased selection:bg-blue-500/30 relative">
      {/* LAYER 1: Background */}
      <DotGridLayer />

      {/* LAYER 2: Main Graph */}
      <div
        className="absolute inset-0 z-10"
        ref={containerRef}
        onClick={resetView}
      >
        <div className="absolute top-8 right-8 z-50 flex gap-3 pointer-events-none">
          <div className="pointer-events-auto flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl">
            <button
              onClick={resetView}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            >
              <RotateCcw size={18} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1 self-center" />
            <button
              onClick={() => setIsPanelOpen(true)}
              className="p-3 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
        <div className="absolute bottom-8 left-8 pointer-events-none opacity-40">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            University Graph v5.2
          </div>
        </div>
      </div>

      {/* LAYER 3: Sidebar */}
      <div
        className={`absolute left-0 top-0 h-full z-20 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col ${isPanelOpen ? "w-[400px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10 overflow-hidden"}`}
      >
        <div className="flex-1 m-6 rounded-[32px] bg-white/[0.02] backdrop-blur-2xl border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden relative">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Network size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">
                    Curriculum
                  </h1>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none mt-0.5">
                    Interactive Graph
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <ChevronRight size={20} className="rotate-180 text-white/50" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Comp Sci", color: "bg-[#30D158]" },
                { label: "Math", color: "bg-[#0A84FF]" },
                { label: "AI/ML", color: "bg-[#BF5AF2]" },
                { label: "Business", color: "bg-[#FF9F0A]" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${f.color} shadow-[0_0_8px_currentColor]`}
                  />
                  <span className="text-[11px] font-semibold text-white/60">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 px-6 overflow-y-auto custom-scrollbar relative space-y-6 pb-6">
            {activeNode ? (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 ease-out space-y-6">
                <div>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 block">
                    Selected Topic
                  </span>
                  <h2 className="text-4xl font-bold tracking-tighter text-white">
                    {activeNode.id}
                  </h2>
                  <div className="flex gap-2 mt-4">
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase text-white/70">
                      {activeNode.type}
                    </span>
                    <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase text-white/70">
                      Credits: {activeNode.val}
                    </span>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 leading-relaxed text-sm text-white/60 font-medium">
                  Detailed breakdown of {activeNode.id}. This node serves as a
                  critical junction in the{" "}
                  {activeNode.group === 1 ? "Computer Science" : "AI"}{" "}
                  curriculum structure.
                </div>
                <button
                  onClick={resetView}
                  className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <Focus size={18} /> Reset Focus
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div>
                  <p className="px-1 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">
                    Physics Engine
                  </p>
                  <div className="space-y-6">
                    <ControlSlider
                      label="Repulsion"
                      value={repulsion}
                      set={setRepulsion}
                      min={-1500}
                      max={-200}
                      step={20}
                    />
                    <ControlSlider
                      label="Float Intensity"
                      value={floatIntensity}
                      set={setFloatIntensity}
                      min={0}
                      max={20}
                      step={1}
                    />
                    <ControlSlider
                      label="Gravity"
                      value={gravity}
                      set={setGravity}
                      min={0}
                      max={0.3}
                      step={0.01}
                    />
                  </div>
                </div>
                <div>
                  <p className="px-1 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">
                    Visuals
                  </p>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <ControlSlider
                        label="Label Visibility Factor"
                        value={labelThreshold}
                        set={setLabelThreshold}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                      />
                    </div>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                  <div className="flex gap-3">
                    <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-200/70 leading-relaxed font-medium">
                      <strong className="text-blue-100">
                        Synchronized Physics:
                      </strong>{" "}
                      Nodes and links now float together in a unified JavaScript
                      render loop.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ControlSlider = ({ label, value, set, min, max, step }: { label: string, value: number, set: (v: number) => void, min: number, max: number, step: number }) => (
  <div className="group space-y-3">
    <div className="flex justify-between items-end">
      <span className="text-xs font-bold text-white/40 tracking-tight group-hover:text-white/60 transition-colors">
        {label}
      </span>
      <span className="text-xs font-mono font-bold text-blue-400 tabular-nums">
        {value}
      </span>
    </div>
    <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: any) => set(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div
        className="absolute h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-300"
        style={{ width: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  </div>
);

// Exported as GraphView at the top
