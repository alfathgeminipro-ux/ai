import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { JournalArticle } from '../types';
import {
  buildJournalYearDistribution,
  type JournalYearBucket,
} from '../utils/journalChartData';
import { LiquidCard } from './LiquidCard';

interface JournalCitationChartProps {
  articles: JournalArticle[];
  yearStart: number;
  yearEnd: number;
  loading: boolean;
  viewMode: 'all' | 'favorites';
  onSelectYear: (year: number) => void;
}

type ChartMetric = 'citations' | 'citedPapers';

interface TooltipState {
  bucket: JournalYearBucket;
  x: number;
  y: number;
}

/**
 * Visualisasi D3.js interaktif distribusi frekuensi artikel tersitasi & total sitasi per tahun.
 * Menggunakan persistent D3 layers (.join enter/update/exit) untuk transisi mulus tanpa flicker,
 * merespons filter rentang tahun, perubahan kata kunci pencarian, ukuran layar, dan tema CSS variables.
 */
export function JournalCitationChart({
  articles,
  yearStart,
  yearEnd,
  loading,
  viewMode,
  onSelectYear,
}: JournalCitationChartProps) {
  const reactId = useId().replace(/:/g, '');
  const barGradId = `marvis-d3-bar-${reactId}`;
  const activeGradId = `marvis-d3-active-${reactId}`;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  const [metric, setMetric] = useState<ChartMetric>('citedPapers');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const onSelectYearRef = useRef(onSelectYear);
  onSelectYearRef.current = onSelectYear;

  const summary = useMemo(
    () => buildJournalYearDistribution(articles, yearStart, yearEnd),
    [articles, yearStart, yearEnd],
  );

  // Pantau lebar kontainer secara responsif di HP dan Laptop
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;

    const updateWidth = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 120) setContainerWidth(w);
    };
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 120) setContainerWidth(w);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render & transisi D3.js dengan persistent SVG layers (.join enter/update/exit)
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || loading || summary.totalPapers === 0) return;

    const buckets = summary.buckets;
    const height = containerWidth < 460 ? 205 : 230;
    const margin = {
      top: 22,
      right: containerWidth < 460 ? 16 : 24,
      bottom: 34,
      left: containerWidth < 460 ? 38 : 48,
    };
    const innerWidth = Math.max(120, containerWidth - margin.left - margin.right);
    const innerHeight = Math.max(80, height - margin.top - margin.bottom);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : 420;

    const svg = d3.select(svgEl);
    svg
      .attr('width', containerWidth)
      .attr('height', height)
      .attr('viewBox', `0 0 ${containerWidth} ${height}`);

    // Inisialisasi defs dan layer groups satu kali agar transisi D3 tetap mulus saat filter berubah
    let defs = svg.select<SVGDefsElement>('defs.marvis-d3-defs');
    if (defs.empty()) {
      defs = svg.append('defs').attr('class', 'marvis-d3-defs');

      const barGrad = defs
        .append('linearGradient')
        .attr('id', barGradId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      barGrad
        .append('stop')
        .attr('offset', '0%')
        .style('stop-color', 'var(--accent-2)')
        .attr('stop-opacity', 0.94);
      barGrad
        .append('stop')
        .attr('offset', '100%')
        .style('stop-color', 'var(--accent)')
        .attr('stop-opacity', 0.34);

      const activeGrad = defs
        .append('linearGradient')
        .attr('id', activeGradId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      activeGrad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#ffffff')
        .attr('stop-opacity', 0.96);
      activeGrad
        .append('stop')
        .attr('offset', '45%')
        .style('stop-color', 'var(--accent-2)')
        .attr('stop-opacity', 0.95);
      activeGrad
        .append('stop')
        .attr('offset', '100%')
        .style('stop-color', 'var(--accent)')
        .attr('stop-opacity', 0.65);
    }

    let rootG = svg.select<SVGGElement>('g.marvis-d3-root');
    if (rootG.empty()) {
      rootG = svg.append('g').attr('class', 'marvis-d3-root');
      rootG.append('g').attr('class', 'marvis-d3-grid');
      rootG.append('g').attr('class', 'marvis-d3-x-axis');
      rootG.append('g').attr('class', 'marvis-d3-y-axis');
      rootG.append('g').attr('class', 'marvis-layer-col-bg');
      rootG.append('g').attr('class', 'marvis-layer-ghost');
      rootG.append('g').attr('class', 'marvis-layer-bars');
      rootG.append('g').attr('class', 'marvis-layer-trend');
      rootG.append('g').attr('class', 'marvis-layer-labels');
      rootG.append('g').attr('class', 'marvis-layer-hits');
    }
    rootG.attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<string>()
      .domain(buckets.map((b) => String(b.year)))
      .range([0, innerWidth])
      .padding(buckets.length === 1 ? 0.62 : 0.32);

    const valueFor = (b: JournalYearBucket) =>
      metric === 'citations' ? b.totalCitations : b.citedPaperCount;

    const maxPrimary =
      metric === 'citations'
        ? (d3.max(buckets, (b) => b.totalCitations) ?? 0)
        : Math.max(
            d3.max(buckets, (b) => b.citedPaperCount) ?? 0,
            d3.max(buckets, (b) => b.paperCount) ?? 0,
          );
    const yMax = Math.max(metric === 'citations' ? 10 : 4, Math.ceil(maxPrimary * 1.18));

    const yScale = d3.scaleLinear().domain([0, yMax]).nice(4).range([innerHeight, 0]);
    const t = d3.transition().duration(duration).ease(d3.easeCubicOut);

    // Garis grid horizontal tipis
    const yGrid = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    rootG
      .select<SVGGElement>('g.marvis-d3-grid')
      .transition(t)
      .call(yGrid)
      .selection()
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('line')
          .attr('stroke', 'rgba(255,255,255,0.08)')
          .attr('stroke-dasharray', '3,4'),
      );

    // Sumbu X (Tahun Publikasi)
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    rootG
      .select<SVGGElement>('g.marvis-d3-x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .transition(t)
      .call(xAxis)
      .selection()
      .call((sel) => sel.select('.domain').attr('stroke', 'rgba(255,255,255,0.14)'))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#cbd5e1')
          .style('font-family', 'var(--font-mono)')
          .style('font-size', '11px'),
      );

    // Sumbu Y (Frekuensi Artikel Tersitasi / Total Sitasi)
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((d) => {
        const num = Number(d);
        if (!Number.isInteger(num)) return '';
        return num >= 1000 ? `${(num / 1000).toFixed(1)}rb` : String(num);
      });

    rootG
      .select<SVGGElement>('g.marvis-d3-y-axis')
      .transition(t)
      .call(yAxis)
      .selection()
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', '#94a3b8')
          .style('font-family', 'var(--font-mono)')
          .style('font-size', '10.5px'),
      );

    const singleYearActive = yearStart === yearEnd;

    // 1) Latar belakang hover kolom (membantu kolom bernilai 0 tetap responsif secara visual)
    const colBgs = rootG
      .select<SVGGElement>('g.marvis-layer-col-bg')
      .selectAll<SVGRectElement, JournalYearBucket>('rect.marvis-d3-col-bg')
      .data(buckets, (b) => String(b.year))
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'marvis-d3-col-bg')
            .attr('data-year', (b) => String(b.year))
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'rgba(255,255,255,0)')
            .style('pointer-events', 'none')
            .attr('x', (b) => xScale(String(b.year)) ?? 0)
            .attr('y', 0)
            .attr('width', xScale.bandwidth())
            .attr('height', innerHeight),
        (update) =>
          update
            .attr('fill', 'rgba(255,255,255,0)')
            .call((sel) =>
              sel
                .transition(t)
                .attr('x', (b) => xScale(String(b.year)) ?? 0)
                .attr('width', xScale.bandwidth())
                .attr('height', innerHeight),
            ),
        (exit) => exit.remove(),
      );

    // 2) Ghost bar total artikel saat mode "Artikel Tersitasi"
    const ghostData = metric === 'citedPapers' ? buckets : [];
    rootG
      .select<SVGGElement>('g.marvis-layer-ghost')
      .selectAll<SVGRectElement, JournalYearBucket>('rect.marvis-total-ghost')
      .data(ghostData, (b) => String(b.year))
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'marvis-total-ghost')
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'rgba(255,255,255,0.07)')
            .attr('stroke', 'rgba(255,255,255,0.16)')
            .attr('stroke-dasharray', '3,3')
            .style('pointer-events', 'none')
            .attr('x', (b) => xScale(String(b.year)) ?? 0)
            .attr('width', xScale.bandwidth())
            .attr('y', innerHeight)
            .attr('height', 0)
            .call((sel) =>
              sel
                .transition(t)
                .attr('y', (b) => yScale(b.paperCount))
                .attr('height', (b) => Math.max(0, innerHeight - yScale(b.paperCount))),
            ),
        (update) =>
          update.call((sel) =>
            sel
              .transition(t)
              .attr('x', (b) => xScale(String(b.year)) ?? 0)
              .attr('width', xScale.bandwidth())
              .attr('y', (b) => yScale(b.paperCount))
              .attr('height', (b) => Math.max(0, innerHeight - yScale(b.paperCount))),
          ),
        (exit) =>
          exit
            .transition(t)
            .attr('y', innerHeight)
            .attr('height', 0)
            .remove(),
      );

    // 3) Batang utama D3 Liquid Glass
    const bars = rootG
      .select<SVGGElement>('g.marvis-layer-bars')
      .selectAll<SVGRectElement, JournalYearBucket>('rect.marvis-d3-bar')
      .data(buckets, (b) => String(b.year))
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'marvis-d3-bar')
            .attr('data-year', (b) => String(b.year))
            .attr('stroke', 'rgba(255,255,255,0.24)')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')
            .attr('x', (b) => xScale(String(b.year)) ?? 0)
            .attr('width', xScale.bandwidth())
            .attr('y', innerHeight)
            .attr('height', 0)
            .attr('fill', (b) =>
              singleYearActive && b.year === yearStart
                ? `url(#${activeGradId})`
                : `url(#${barGradId})`,
            )
            .call((sel) =>
              sel
                .transition(t)
                .attr('rx', (b) => (valueFor(b) > 0 ? 10 : 2))
                .attr('ry', (b) => (valueFor(b) > 0 ? 10 : 2))
                .attr('opacity', (b) => (valueFor(b) > 0 ? 1 : 0.35))
                .attr('y', (b) => {
                  const v = valueFor(b);
                  return v > 0 ? Math.min(innerHeight - 6, yScale(v)) : innerHeight - 2;
                })
                .attr('height', (b) => {
                  const v = valueFor(b);
                  return v > 0 ? Math.max(6, innerHeight - yScale(v)) : 2;
                }),
            ),
        (update) =>
          update
            .style('filter', 'none')
            .attr('stroke', 'rgba(255,255,255,0.24)')
            .attr('fill', (b) =>
              singleYearActive && b.year === yearStart
                ? `url(#${activeGradId})`
                : `url(#${barGradId})`,
            )
            .call((sel) =>
              sel
                .transition(t)
                .attr('x', (b) => xScale(String(b.year)) ?? 0)
                .attr('width', xScale.bandwidth())
                .attr('rx', (b) => (valueFor(b) > 0 ? 10 : 2))
                .attr('ry', (b) => (valueFor(b) > 0 ? 10 : 2))
                .attr('opacity', (b) => (valueFor(b) > 0 ? 1 : 0.35))
                .attr('y', (b) => {
                  const v = valueFor(b);
                  return v > 0 ? Math.min(innerHeight - 6, yScale(v)) : innerHeight - 2;
                })
                .attr('height', (b) => {
                  const v = valueFor(b);
                  return v > 0 ? Math.max(6, innerHeight - yScale(v)) : 2;
                }),
            ),
        (exit) =>
          exit
            .transition(t)
            .attr('y', innerHeight)
            .attr('height', 0)
            .attr('opacity', 0)
            .remove(),
      );

    // 4) Garis tren halus jumlah artikel tersitasi saat mode "Total Sitasi" & >= 2 tahun
    const showTrendOverlay = metric === 'citations' && buckets.length >= 2;
    const maxCited = Math.max(1, d3.max(buckets, (b) => b.citedPaperCount) ?? 1);
    const yCitedScale = d3
      .scaleLinear()
      .domain([0, maxCited * 1.25])
      .range([innerHeight - 6, 12]);

    const trendLayer = rootG.select<SVGGElement>('g.marvis-layer-trend');
    if (showTrendOverlay) {
      const lineGen = d3
        .line<JournalYearBucket>()
        .x((b) => (xScale(String(b.year)) ?? 0) + xScale.bandwidth() / 2)
        .y((b) => yCitedScale(b.citedPaperCount))
        .curve(d3.curveMonotoneX);

      trendLayer
        .selectAll<SVGPathElement, JournalYearBucket[]>('path.marvis-trend-line')
        .data([buckets])
        .join(
          (enter) =>
            enter
              .append('path')
              .attr('class', 'marvis-trend-line')
              .attr('fill', 'none')
              .style('stroke', '#ffffff')
              .attr('stroke-opacity', 0.65)
              .attr('stroke-width', 1.8)
              .style('pointer-events', 'none')
              .attr('d', lineGen),
          (update) => update.transition(t).attr('d', lineGen),
          (exit) => exit.remove(),
        );

      trendLayer
        .selectAll<SVGCircleElement, JournalYearBucket>('circle.marvis-trend-dot')
        .data(buckets, (b) => String(b.year))
        .join(
          (enter) =>
            enter
              .append('circle')
              .attr('class', 'marvis-trend-dot')
              .attr('r', 3.5)
              .style('fill', 'var(--bg-1)')
              .style('stroke', 'var(--accent-2)')
              .attr('stroke-width', 2)
              .style('pointer-events', 'none')
              .attr('cx', (b) => (xScale(String(b.year)) ?? 0) + xScale.bandwidth() / 2)
              .attr('cy', (b) => yCitedScale(b.citedPaperCount)),
          (update) =>
            update
              .transition(t)
              .attr('cx', (b) => (xScale(String(b.year)) ?? 0) + xScale.bandwidth() / 2)
              .attr('cy', (b) => yCitedScale(b.citedPaperCount)),
          (exit) => exit.remove(),
        );
    } else {
      trendLayer.selectAll('*').remove();
    }

    // 5) Label angka di atas batang tanpa bertabrakan dengan titik tren
    rootG
      .select<SVGGElement>('g.marvis-layer-labels')
      .selectAll<SVGTextElement, JournalYearBucket>('text.marvis-bar-val')
      .data(buckets, (b) => String(b.year))
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'marvis-bar-val')
            .attr('text-anchor', 'middle')
            .attr('fill', '#e2e8f0')
            .style('font-family', 'var(--font-mono)')
            .style('font-size', '10.5px')
            .style('pointer-events', 'none')
            .attr('x', (b) => (xScale(String(b.year)) ?? 0) + xScale.bandwidth() / 2)
            .attr('y', innerHeight - 10)
            .attr('opacity', 0)
            .text((b) => {
              const v = valueFor(b);
              return v > 0 ? v.toLocaleString('id-ID') : '0';
            })
            .call((sel) =>
              sel
                .transition(t)
                .attr('y', (b) => {
                  const v = valueFor(b);
                  const barTop = v > 0 ? Math.min(innerHeight - 6, yScale(v)) : innerHeight - 2;
                  if (showTrendOverlay) {
                    const dotY = yCitedScale(b.citedPaperCount);
                    return Math.max(10, Math.min(barTop - 7, dotY - 10));
                  }
                  return Math.max(10, barTop - 7);
                })
                .attr('opacity', 0.92),
            ),
        (update) =>
          update
            .text((b) => {
              const v = valueFor(b);
              return v > 0 ? v.toLocaleString('id-ID') : '0';
            })
            .call((sel) =>
              sel
                .transition(t)
                .attr('x', (b) => (xScale(String(b.year)) ?? 0) + xScale.bandwidth() / 2)
                .attr('y', (b) => {
                  const v = valueFor(b);
                  const barTop = v > 0 ? Math.min(innerHeight - 6, yScale(v)) : innerHeight - 2;
                  if (showTrendOverlay) {
                    const dotY = yCitedScale(b.citedPaperCount);
                    return Math.max(10, Math.min(barTop - 7, dotY - 10));
                  }
                  return Math.max(10, barTop - 7);
                })
                .attr('opacity', 0.92),
            ),
        (exit) => exit.transition(t).attr('opacity', 0).remove(),
      );

    // 6) Zona sentuh transparan penuh per kolom tahun (termasuk tahun bernilai 0)
    const hitZones = rootG
      .select<SVGGElement>('g.marvis-layer-hits')
      .selectAll<SVGRectElement, JournalYearBucket>('rect.marvis-d3-hit')
      .data(buckets, (b) => String(b.year))
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'marvis-d3-hit')
            .attr('data-year', (b) => String(b.year))
            .attr('role', 'button')
            .attr('tabindex', 0)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer'),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr(
        'aria-label',
        (b) =>
          `Tahun ${b.year}: ${b.citedPaperCount} dari ${b.paperCount} artikel tersitasi, total ${b.totalCitations} sitasi. Klik untuk filter tahun ${b.year}.`,
      )
      .attr('x', (b) => xScale(String(b.year)) ?? 0)
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', innerHeight);

    const showTipFor = (bucket: JournalYearBucket) => {
      const bx = (xScale(String(bucket.year)) ?? 0) + xScale.bandwidth() / 2 + margin.left;
      const v = valueFor(bucket);
      const by = Math.max(34, (v > 0 ? yScale(v) : innerHeight * 0.72) + margin.top);
      colBgs.filter((d) => d.year === bucket.year).attr('fill', 'rgba(255,255,255,0.06)');
      bars
        .filter((d) => d.year === bucket.year)
        .attr('fill', `url(#${activeGradId})`)
        .attr('stroke', 'rgba(255,255,255,0.7)')
        .attr('opacity', 1)
        .style('filter', 'drop-shadow(0 0 12px var(--glow))');
      setTooltip({ bucket, x: bx, y: by });
    };

    const hideTipFor = (bucket: JournalYearBucket) => {
      colBgs.filter((d) => d.year === bucket.year).attr('fill', 'rgba(255,255,255,0)');
      bars
        .filter((d) => d.year === bucket.year)
        .attr(
          'fill',
          singleYearActive && bucket.year === yearStart
            ? `url(#${activeGradId})`
            : `url(#${barGradId})`,
        )
        .attr('stroke', 'rgba(255,255,255,0.24)')
        .attr('opacity', valueFor(bucket) > 0 ? 1 : 0.35)
        .style('filter', 'none');
      setTooltip(null);
    };

    hitZones
      .on('mouseenter', (_event, d) => showTipFor(d))
      .on('focus', (_event, d) => showTipFor(d))
      .on('mouseleave', (_event, d) => hideTipFor(d))
      .on('blur', (_event, d) => hideTipFor(d))
      .on('click', (_event, d) => {
        setTooltip(null);
        onSelectYearRef.current(d.year);
      })
      .on('keydown', (event: KeyboardEvent, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setTooltip(null);
          onSelectYearRef.current(d.year);
        }
      });

    return () => {
      setTooltip(null);
    };
  }, [summary, metric, containerWidth, loading, yearStart, yearEnd, barGradId, activeGradId]);

  const clampedTipX = tooltip
    ? Math.max(120, Math.min(containerWidth - 120, tooltip.x))
    : 0;

  const activePeakYear = metric === 'citedPapers' ? summary.peakCitedYear : summary.peakYear;
  const activePeakLabel =
    metric === 'citedPapers'
      ? `${summary.peakCitedCount.toLocaleString('id-ID')} artikel`
      : `${summary.peakCitations.toLocaleString('id-ID')} sitasi`;

  return (
    <LiquidCard
      title="Distribusi Jurnal Tersitasi per Tahun"
      subtitle={
        viewMode === 'favorites'
          ? 'Frekuensi artikel tersitasi dari favorit tersimpan · klik kolom tahun untuk filter'
          : 'Frekuensi artikel tersitasi per tahun publikasi (D3.js) · klik kolom tahun untuk filter'
      }
      headerRight={
        <div
          role="group"
          aria-label="Pilih metrik grafik sitasi"
          className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1 border border-white/10"
        >
          <button
            type="button"
            onClick={() => setMetric('citedPapers')}
            aria-pressed={metric === 'citedPapers'}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              metric === 'citedPapers'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Artikel Tersitasi
          </button>
          <button
            type="button"
            onClick={() => setMetric('citations')}
            aria-pressed={metric === 'citations'}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              metric === 'citations'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Total Sitasi
          </button>
        </div>
      }
    >
      {/* Ringkasan metrik bersih tanpa kotak pill */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>
            <strong className="font-mono-tabular text-white">
              {summary.totalCitedPapers}/{summary.totalPapers}
            </strong>{' '}
            artikel tersitasi
          </span>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span>
            <strong className="font-mono-tabular text-[var(--accent-2)]">
              {summary.totalCitations.toLocaleString('id-ID')}
            </strong>{' '}
            total sitasi
          </span>
          {activePeakYear && (
            <>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>
                Puncak tahun{' '}
                <strong className="font-mono-tabular text-white">{activePeakYear}</strong> (
                <span className="font-mono-tabular">{activePeakLabel}</span>)
              </span>
            </>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          {metric === 'citations'
            ? 'Batang: total sitasi · Garis putih: tren artikel tersitasi'
            : 'Batang berwarna: artikel tersitasi · Garis putus: total artikel'}
        </span>
      </div>

      {/* Area Grafik D3.js dengan estetika Liquid Glass berbasis CSS variables */}
      <div
        ref={wrapperRef}
        data-testid="journal-citation-chart"
        data-metric={metric}
        style={{
          background:
            'linear-gradient(160deg, var(--surface-tint), rgba(255, 255, 255, 0.025))',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        }}
        className="relative w-full rounded-2xl border border-white/12 px-1 pt-1"
      >
        {loading ? (
          <div className="p-4 space-y-3" aria-label="Memuat visualisasi distribusi jurnal">
            <div className="marvis-skeleton h-[185px] w-full rounded-xl" />
          </div>
        ) : summary.totalPapers === 0 ? (
          <div className="flex h-[185px] items-center justify-center px-4 text-center text-xs text-slate-400">
            Belum ada artikel dalam rentang tahun {yearStart}–{yearEnd} untuk divisualisasikan.
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              role="img"
              aria-label={`Grafik D3 distribusi ${
                metric === 'citations' ? 'total sitasi' : 'frekuensi artikel tersitasi'
              } per tahun ${yearStart} sampai ${yearEnd}`}
              className="block w-full overflow-visible"
            />

            {/* Tooltip Interaktif Liquid Glass */}
            {tooltip && (
              <div
                role="status"
                style={{
                  left: `${clampedTipX}px`,
                  top: `${Math.max(8, tooltip.y - 12)}px`,
                  background: 'color-mix(in srgb, var(--bg-1) 88%, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(var(--glass-blur)) saturate(180%)',
                  boxShadow: '0 16px 36px rgba(0,0,0,0.45), 0 0 20px var(--glow)',
                }}
                className="pointer-events-none absolute z-20 w-[230px] -translate-x-1/2 -translate-y-full rounded-2xl border border-white/20 p-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="font-mono-tabular">Tahun {tooltip.bucket.year}</span>
                  <span className="font-mono-tabular text-[var(--accent-2)]">
                    {tooltip.bucket.totalCitations.toLocaleString('id-ID')} sitasi
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-300 font-mono-tabular">
                  <div>
                    Tersitasi: {tooltip.bucket.citedPaperCount} / {tooltip.bucket.paperCount} artikel
                  </div>
                  <div>Rata-rata: {tooltip.bucket.avgCitations} sitasi/artikel</div>
                </div>
                {tooltip.bucket.topPaperTitle && (
                  <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[10px] leading-snug text-slate-400 line-clamp-2">
                    Teratas: {tooltip.bucket.topPaperTitle}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </LiquidCard>
  );
}
