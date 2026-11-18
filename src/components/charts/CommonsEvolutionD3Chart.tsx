/**
 * CommonsEvolutionD3Chart.tsx
 * Componente de Data Visualization dinámico construido con D3.js.
 * Visualiza la evolución histórica turno a turno de:
 * - Bienes Comunes recuperados
 * - Bienes Privatizados restantes
 * - Bienes Públicos en transición (serie opcional activable)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TurnCommonsSnapshot } from '../../types/game';
import { playSound } from '../../utils/audio';

interface CommonsEvolutionD3ChartProps {
  data: TurnCommonsSnapshot[];
  height?: number;
  compact?: boolean;
  title?: string;
}

export const CommonsEvolutionD3Chart: React.FC<CommonsEvolutionD3ChartProps> = ({
  data,
  height = 265,
  compact = false,
  title = 'Evolución Histórica: Bienes Comunes vs Privatizados'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uidRef = useRef(`d3_${Math.random().toString(36).slice(2, 9)}`);

  const [containerWidth, setContainerWidth] = useState<number>(640);
  const [showCommons, setShowCommons] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showPublic, setShowPublic] = useState(false);
  const [windowMode, setWindowMode] = useState<'ALL' | 'RECENT'>('ALL');
  const [hoveredPoint, setHoveredPoint] = useState<{
    snapshot: TurnCommonsSnapshot;
    x: number;
    yCommon: number;
    yPrivate: number;
  } | null>(null);

  // Observar ancho real del contenedor para renderizado D3 100% responsivo
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(260, Math.floor(el.clientWidth));
      setContainerWidth(next);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.turn - b.turn);
    if (windowMode === 'RECENT' && sorted.length > 12) {
      return sorted.slice(-12);
    }
    return sorted;
  }, [data, windowMode]);

  const latest = visibleData[visibleData.length - 1] ?? null;
  const baselineCommon = data[0]?.commonCount ?? latest?.commonCount ?? 0;
  const totalTiles = latest?.totalResourceTiles ?? 24;

  // Renderizado y transiciones dinámicas D3
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || visibleData.length === 0) return;

    const margin = compact
      ? { top: 14, right: 16, bottom: 26, left: 32 }
      : { top: 18, right: 20, bottom: 32, left: 38 };

    const innerWidth = Math.max(160, containerWidth - margin.left - margin.right);
    const innerHeight = Math.max(120, height - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.attr('width', containerWidth).attr('height', height);

    // Inicializar estructura SVG una sola vez para permitir transiciones suaves entre turnos
    let defs = svg.select<SVGDefsElement>('defs.d3-chart-defs');
    if (defs.empty()) {
      defs = svg.append('defs').attr('class', 'd3-chart-defs');

      const commonGrad = defs
        .append('linearGradient')
        .attr('id', `${uidRef.current}-common-grad`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      commonGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.28);
      commonGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.01);

      const privateGrad = defs
        .append('linearGradient')
        .attr('id', `${uidRef.current}-private-grad`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      privateGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.24);
      privateGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.01);
    }

    let rootG = svg.select<SVGGElement>('g.d3-root');
    if (rootG.empty()) {
      rootG = svg.append('g').attr('class', 'd3-root');
      rootG.append('g').attr('class', 'd3-grid-y');
      rootG.append('g').attr('class', 'd3-baseline');
      rootG.append('g').attr('class', 'd3-areas');
      rootG.append('g').attr('class', 'd3-lines');
      rootG.append('g').attr('class', 'd3-dots');
      rootG.append('g').attr('class', 'd3-axes');
      rootG.append('g').attr('class', 'd3-hover-layer');
      rootG.append('rect').attr('class', 'd3-pointer-capture');
    }

    rootG.attr('transform', `translate(${margin.left},${margin.top})`);

    const minTurn = visibleData[0].turn;
    const maxTurn = visibleData[visibleData.length - 1].turn;
    const xDomainMax = maxTurn === minTurn ? minTurn + 1 : maxTurn;

    const xScale = d3
      .scaleLinear()
      .domain([minTurn, xDomainMax])
      .range([0, innerWidth]);

    const maxObserved =
      d3.max(visibleData, d => Math.max(d.commonCount, d.privateCount, d.publicCount, d.totalResourceTiles)) ??
      totalTiles;
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(4, maxObserved)])
      .nice()
      .range([innerHeight, 0]);

    const t = d3.transition().duration(420).ease(d3.easeCubicOut);

    // 1. Rejilla horizontal sutil
    const yTicks = yScale.ticks(compact ? 4 : 5).filter(Number.isInteger);
    const gridG = rootG.select<SVGGElement>('g.d3-grid-y');
    gridG
      .selectAll<SVGLineElement, number>('line.grid-line')
      .data(yTicks, d => String(d))
      .join(
        enter =>
          enter
            .append('line')
            .attr('class', 'grid-line')
            .attr('x1', 0)
            .attr('x2', innerWidth)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', '#1e293b')
            .attr('stroke-dasharray', '3 3'),
        update =>
          update
            .transition(t)
            .attr('x2', innerWidth)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d)),
        exit => exit.remove()
      );

    // 2. Línea de referencia base (Bienes Comunes iniciales al Turno 0)
    const baselineG = rootG.select<SVGGElement>('g.d3-baseline');
    const baselineData = showCommons ? [baselineCommon] : [];
    baselineG
      .selectAll<SVGLineElement, number>('line.baseline-rule')
      .data(baselineData)
      .join(
        enter =>
          enter
            .append('line')
            .attr('class', 'baseline-rule')
            .attr('x1', 0)
            .attr('x2', innerWidth)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', '#10b981')
            .attr('stroke-opacity', 0.35)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4 4'),
        update =>
          update
            .transition(t)
            .attr('x2', innerWidth)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d)),
        exit => exit.remove()
      );

    baselineG
      .selectAll<SVGTextElement, number>('text.baseline-label')
      .data(baselineData)
      .join(
        enter =>
          enter
            .append('text')
            .attr('class', 'baseline-label')
            .attr('x', innerWidth - 4)
            .attr('y', d => yScale(d) - 4)
            .attr('text-anchor', 'end')
            .attr('fill', '#6ee7b7')
            .attr('fill-opacity', 0.65)
            .attr('font-size', '9.5px')
            .text(d => `Base inicio: ${d}`),
        update =>
          update
            .transition(t)
            .attr('x', innerWidth - 4)
            .attr('y', d => yScale(d) - 4)
            .text(d => `Base inicio: ${d}`),
        exit => exit.remove()
      );

    // 3. Generadores de líneas y áreas D3
    const curve = d3.curveMonotoneX;

    const areaCommon = d3
      .area<TurnCommonsSnapshot>()
      .x(d => xScale(d.turn))
      .y0(innerHeight)
      .y1(d => yScale(d.commonCount))
      .curve(curve);

    const areaPrivate = d3
      .area<TurnCommonsSnapshot>()
      .x(d => xScale(d.turn))
      .y0(innerHeight)
      .y1(d => yScale(d.privateCount))
      .curve(curve);

    const lineCommon = d3
      .line<TurnCommonsSnapshot>()
      .x(d => xScale(d.turn))
      .y(d => yScale(d.commonCount))
      .curve(curve);

    const linePrivate = d3
      .line<TurnCommonsSnapshot>()
      .x(d => xScale(d.turn))
      .y(d => yScale(d.privateCount))
      .curve(curve);

    const linePublic = d3
      .line<TurnCommonsSnapshot>()
      .x(d => xScale(d.turn))
      .y(d => yScale(d.publicCount))
      .curve(curve);

    // Áreas suaves bajo líneas principales
    const areasG = rootG.select<SVGGElement>('g.d3-areas');
    const areaConfigs = [
      ...(showCommons
        ? [{ id: 'common-area', d: areaCommon(visibleData) || '', fill: `url(#${uidRef.current}-common-grad)` }]
        : []),
      ...(showPrivate
        ? [{ id: 'private-area', d: areaPrivate(visibleData) || '', fill: `url(#${uidRef.current}-private-grad)` }]
        : [])
    ];

    areasG
      .selectAll<SVGPathElement, { id: string; d: string; fill: string }>('path.area-path')
      .data(areaConfigs, item => item.id)
      .join(
        enter =>
          enter
            .append('path')
            .attr('class', 'area-path')
            .attr('fill', item => item.fill)
            .attr('d', item => item.d)
            .attr('opacity', 0)
            .call(sel => sel.transition(t).attr('opacity', 1)),
        update =>
          update
            .attr('fill', item => item.fill)
            .transition(t)
            .attr('d', item => item.d)
            .attr('opacity', 1),
        exit => exit.remove()
      );

    // Líneas dinámicas
    const linesG = rootG.select<SVGGElement>('g.d3-lines');
    const lineConfigs = [
      ...(showPublic
        ? [{ id: 'public-line', d: linePublic(visibleData) || '', stroke: '#38bdf8', width: 1.75, dash: '4 3' }]
        : []),
      ...(showPrivate
        ? [{ id: 'private-line', d: linePrivate(visibleData) || '', stroke: '#f43f5e', width: 2.5, dash: '' }]
        : []),
      ...(showCommons
        ? [{ id: 'common-line', d: lineCommon(visibleData) || '', stroke: '#10b981', width: 2.75, dash: '' }]
        : [])
    ];

    linesG
      .selectAll<SVGPathElement, { id: string; d: string; stroke: string; width: number; dash: string }>('path.series-line')
      .data(lineConfigs, item => item.id)
      .join(
        enter =>
          enter
            .append('path')
            .attr('class', 'series-line')
            .attr('fill', 'none')
            .attr('stroke', item => item.stroke)
            .attr('stroke-width', item => item.width)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-dasharray', item => item.dash || null)
            .attr('d', item => item.d)
            .attr('opacity', 0)
            .call(sel => sel.transition(t).attr('opacity', 1)),
        update =>
          update
            .attr('stroke', item => item.stroke)
            .attr('stroke-width', item => item.width)
            .attr('stroke-dasharray', item => item.dash || null)
            .transition(t)
            .attr('d', item => item.d)
            .attr('opacity', 1),
        exit => exit.remove()
      );

    // 4. Puntos por turno (discretos cuando hay pocos turnos + marcador final destacado)
    const dotsG = rootG.select<SVGGElement>('g.d3-dots');
    const showAllDots = visibleData.length <= 24;
    const dotPoints = showAllDots
      ? visibleData
      : [visibleData[0], visibleData[visibleData.length - 1]];

    interface DotDatum {
      key: string;
      turn: number;
      value: number;
      color: string;
      isLatest: boolean;
    }

    const latestTurn = visibleData[visibleData.length - 1].turn;
    const dotData: DotDatum[] = [];
    dotPoints.forEach(pt => {
      const isLatest = pt.turn === latestTurn;
      if (showCommons) {
        dotData.push({
          key: `c-${pt.turn}`,
          turn: pt.turn,
          value: pt.commonCount,
          color: '#10b981',
          isLatest
        });
      }
      if (showPrivate) {
        dotData.push({
          key: `p-${pt.turn}`,
          turn: pt.turn,
          value: pt.privateCount,
          color: '#f43f5e',
          isLatest
        });
      }
      if (showPublic) {
        dotData.push({
          key: `u-${pt.turn}`,
          turn: pt.turn,
          value: pt.publicCount,
          color: '#38bdf8',
          isLatest
        });
      }
    });

    dotsG
      .selectAll<SVGCircleElement, DotDatum>('circle.turn-dot')
      .data(dotData, d => d.key)
      .join(
        enter =>
          enter
            .append('circle')
            .attr('class', 'turn-dot')
            .attr('cx', d => xScale(d.turn))
            .attr('cy', d => yScale(d.value))
            .attr('r', 0)
            .attr('fill', d => d.color)
            .attr('stroke', '#020617')
            .attr('stroke-width', 1.5)
            .call(sel => sel.transition(t).attr('r', d => (d.isLatest ? 4.5 : 2.75))),
        update =>
          update
            .transition(t)
            .attr('cx', d => xScale(d.turn))
            .attr('cy', d => yScale(d.value))
            .attr('r', d => (d.isLatest ? 4.5 : 2.75))
            .attr('fill', d => d.color),
        exit => exit.remove()
      );

    // 5. Ejes X e Y con formato limpio y tabular
    const axesG = rootG.select<SVGGElement>('g.d3-axes');
    let xAxisG = axesG.select<SVGGElement>('g.x-axis');
    if (xAxisG.empty()) xAxisG = axesG.append('g').attr('class', 'x-axis');
    let yAxisG = axesG.select<SVGGElement>('g.y-axis');
    if (yAxisG.empty()) yAxisG = axesG.append('g').attr('class', 'y-axis');

    const desiredXTicks = Math.min(compact ? 5 : 8, Math.max(2, visibleData.length));
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(desiredXTicks)
      .tickFormat(domainVal => {
        const num = Math.round(Number(domainVal));
        if (num === 0) return 'Inicio';
        return `T${num}`;
      });

    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(yTicks)
      .tickFormat(d => `${Math.round(Number(d))}`);

    xAxisG
      .attr('transform', `translate(0,${innerHeight})`)
      .transition(t)
      .call(xAxis);

    yAxisG.transition(t).call(yAxis);

    axesG.selectAll('.domain').attr('stroke', '#334155');
    axesG.selectAll('.tick line').attr('stroke', '#334155');
    axesG
      .selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10.5px')
      .style('font-variant-numeric', 'tabular-nums');

    // 6. Captura de puntero D3 (bisector) para crosshair y tooltip interactivo
    const bisectTurn = d3.bisector<TurnCommonsSnapshot, number>(d => d.turn).center;
    const capture = rootG.select<SVGRectElement>('rect.d3-pointer-capture');
    capture
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', event => {
        const [mx] = d3.pointer(event);
        const turnVal = xScale.invert(mx);
        const idx = Math.min(
          visibleData.length - 1,
          Math.max(0, bisectTurn(visibleData, turnVal))
        );
        const snap = visibleData[idx];
        if (!snap) return;

        setHoveredPoint({
          snapshot: snap,
          x: xScale(snap.turn) + margin.left,
          yCommon: yScale(snap.commonCount) + margin.top,
          yPrivate: yScale(snap.privateCount) + margin.top
        });
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
      });
  }, [
    visibleData,
    containerWidth,
    height,
    compact,
    showCommons,
    showPrivate,
    showPublic,
    baselineCommon,
    totalTiles
  ]);

  // Crosshair SVG sincronizado con hoveredPoint
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const margin = compact
      ? { top: 14, right: 16, bottom: 26, left: 32 }
      : { top: 18, right: 20, bottom: 32, left: 38 };
    const innerHeight = Math.max(120, height - margin.top - margin.bottom);

    const hoverG = d3.select(svgEl).select<SVGGElement>('g.d3-hover-layer');
    if (hoverG.empty()) return;

    hoverG.selectAll('*').remove();
    if (!hoveredPoint) return;

    const localX = hoveredPoint.x - margin.left;
    hoverG
      .append('line')
      .attr('x1', localX)
      .attr('x2', localX)
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    if (showCommons) {
      hoverG
        .append('circle')
        .attr('cx', localX)
        .attr('cy', hoveredPoint.yCommon - margin.top)
        .attr('r', 5.5)
        .attr('fill', '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }

    if (showPrivate) {
      hoverG
        .append('circle')
        .attr('cx', localX)
        .attr('cy', hoveredPoint.yPrivate - margin.top)
        .attr('r', 5.5)
        .attr('fill', '#f43f5e')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }
  }, [hoveredPoint, height, compact, showCommons, showPrivate]);

  const toggleSeries = (series: 'COMMON' | 'PRIVATE' | 'PUBLIC') => {
    playSound.uiClick();
    if (series === 'COMMON') {
      if (showCommons && !showPrivate && !showPublic) return;
      setShowCommons(prev => !prev);
    } else if (series === 'PRIVATE') {
      if (showPrivate && !showCommons && !showPublic) return;
      setShowPrivate(prev => !prev);
    } else {
      if (showPublic && !showCommons && !showPrivate) return;
      setShowPublic(prev => !prev);
    }
  };

  return (
    <div className="space-y-2.5 text-left">
      {/* Cabecera de métricas y controles interactivos de series */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-100 truncate">
            {title}
          </div>
          {latest && (
            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums mt-0.5">
              <span>
                Comunes:{' '}
                <strong className="text-emerald-400">{latest.commonCount}</strong>
                <span className="text-emerald-300/80 ml-1">
                  ({latest.recoveredDelta >= 0 ? `+${latest.recoveredDelta}` : latest.recoveredDelta} recuperados)
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Privatizados:{' '}
                <strong className="text-rose-400">{latest.privateCount}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {latest.turn === 0 ? 'Inicio' : `Turno ${latest.turn} (R${latest.round})`}
              </span>
            </div>
          )}
        </div>

        {/* Controles interactivos de series y ventana */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => toggleSeries('COMMON')}
            aria-pressed={showCommons}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showCommons
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-0.5 bg-emerald-400 inline-block" />
            <span>Comunes</span>
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('PRIVATE')}
            aria-pressed={showPrivate}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showPrivate
                ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-0.5 bg-rose-400 inline-block" />
            <span>Privatizados</span>
          </button>

          <button
            type="button"
            onClick={() => toggleSeries('PUBLIC')}
            aria-pressed={showPublic}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showPublic
                ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-0.5 bg-sky-400 inline-block" />
            <span>Públicos</span>
          </button>

          {data.length > 12 && (
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                setWindowMode(prev => (prev === 'ALL' ? 'RECENT' : 'ALL'));
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              title="Alternar entre toda la partida y los últimos 12 turnos"
            >
              {windowMode === 'ALL' ? 'Todos' : 'Últimos 12'}
            </button>
          )}
        </div>
      </div>

      {/* Lienzo SVG D3 */}
      <div
        ref={containerRef}
        className="relative w-full bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden"
      >
        <svg
          ref={svgRef}
          role="img"
          aria-label="Gráfico de líneas D3 de bienes comunes recuperados frente a bienes privatizados por turno"
          className="block w-full select-none"
        />

        {/* Tooltip contextual posicionado dinámicamente */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-2 z-10 bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-[11px] min-w-[164px]"
            style={{
              left:
                hoveredPoint.x > containerWidth * 0.62
                  ? Math.max(8, hoveredPoint.x - 178)
                  : Math.min(containerWidth - 172, hoveredPoint.x + 12)
            }}
          >
            <div className="font-bold text-white border-b border-slate-800 pb-1 mb-1 tabular-nums flex items-center justify-between gap-2">
              <span>
                {hoveredPoint.snapshot.turn === 0
                  ? 'Inicio (T0)'
                  : `Turno ${hoveredPoint.snapshot.turn} · R${hoveredPoint.snapshot.round}`}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mb-1.5 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: hoveredPoint.snapshot.actorColor || '#14b8a6' }}
              />
              <span className="truncate">{hoveredPoint.snapshot.actorName}</span>
            </div>
            <div className="space-y-0.5 tabular-nums">
              <div className="flex items-center justify-between gap-3">
                <span className="text-emerald-300">Comunes</span>
                <span className="font-bold text-white">
                  {hoveredPoint.snapshot.commonCount}
                  <span className="text-emerald-400/80 text-[10px] ml-1">
                    ({hoveredPoint.snapshot.recoveredDelta >= 0 ? '+' : ''}
                    {hoveredPoint.snapshot.recoveredDelta})
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-rose-300">Privatizados</span>
                <span className="font-bold text-white">
                  {hoveredPoint.snapshot.privateCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sky-300">Públicos</span>
                <span className="font-bold text-white">
                  {hoveredPoint.snapshot.publicCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {data.length <= 1 && (
          <div className="px-3 pb-2 text-[10px] text-slate-500">
            El gráfico se actualiza automáticamente al completarse cada turno de la partida.
          </div>
        )}
      </div>
    </div>
  );
};
