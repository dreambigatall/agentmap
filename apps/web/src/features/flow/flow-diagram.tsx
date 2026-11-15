'use client';

import {
  DEFAULT_GEOMETRY,
  edgePath,
  flowSize,
  nodeBox,
  type AgentColor,
  type FlowLayout,
  type FlowNode,
} from '@skillflow/shared';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgentBadge } from '../agents/agent-badge';

export type NodeMark = 'new' | 'changed';

const g = DEFAULT_GEOMETRY;
const STEP_MS = 1600;

function describe(node: FlowNode, laneLabel: string): string {
  if (node.kind === 'start') return `Start, ${laneLabel}: ${node.text || 'no trigger yet'}`;
  return `Step ${node.number}, ${laneLabel}${node.isApproval ? ', approval' : ''}: ${node.text || 'not described yet'}`;
}

/**
 * Draws a flow as swimlanes: one row per actor, one column per step, connectors between.
 * Built from layoutFlow(), so it redraws by itself whenever the steps change.
 * With `walkthrough`, Play highlights one step at a time.
 */
export function FlowDiagram({
  layout,
  agent,
  label,
  hrefForSkill,
  marks,
  walkthrough = true,
}: {
  layout: FlowLayout;
  agent: { shortName: string; color: AgentColor };
  /** Names the diagram for screen readers, e.g. "Swimlane for Monthly KPI planning". */
  label: string;
  /** Makes each skill name a link (the full flow). */
  hrefForSkill?: (skillId: string) => string;
  /** Marks new and changed steps after a save, by node id. */
  marks?: Map<string, NodeMark>;
  walkthrough?: boolean;
}) {
  const size = flowSize(layout);
  const byId = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout.nodes]);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const nodeRefs = useRef(new Map<string, HTMLLIElement>());

  // Advance while playing; stop at the end.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((current) => {
        const next = current === null ? 0 : current + 1;
        if (next >= layout.nodes.length) {
          setPlaying(false);
          return current;
        }
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, layout.nodes.length]);

  // Keep the highlighted step in view.
  useEffect(() => {
    if (active === null) return;
    const node = layout.nodes[active];
    const element = node && nodeRefs.current.get(node.id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }, [active, layout.nodes]);

  // A changed flow (an edit while the walkthrough is open) starts again from the top.
  useEffect(() => {
    setActive(null);
    setPlaying(false);
  }, [layout.nodes.length]);

  const activeNode = active === null ? null : layout.nodes[active];
  const lit = activeNode?.id;

  function play() {
    if (active === null || active >= layout.nodes.length - 1) setActive(0);
    setPlaying(true);
  }

  if (layout.nodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing to draw yet. Add what starts the skill and its steps.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {walkthrough && (
        <div className="flex flex-wrap items-center gap-2">
          {playing ? (
            <Button variant="secondary" size="sm" onClick={() => setPlaying(false)}>
              ❚❚ Pause
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={play}>
              ▶ {active === null ? 'Play walkthrough' : 'Play'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous step"
            disabled={active === null || active === 0}
            onClick={() => {
              setPlaying(false);
              setActive((a) => Math.max(0, (a ?? 0) - 1));
            }}
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next step"
            disabled={active !== null && active >= layout.nodes.length - 1}
            onClick={() => {
              setPlaying(false);
              setActive((a) => (a === null ? 0 : Math.min(layout.nodes.length - 1, a + 1)));
            }}
          >
            ›
          </Button>
          {active !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPlaying(false);
                setActive(null);
              }}
            >
              Stop
            </Button>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {active === null ? `${layout.nodes.length} boxes` : `${active + 1} of ${layout.nodes.length}`}
          </span>
          <p className="sr-only" aria-live="polite">
            {activeNode ? describe(activeNode, layout.lanes[activeNode.lane].label) : ''}
          </p>
        </div>
      )}

      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-background focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="relative" style={{ width: size.width, height: size.height }}>
          {/* Lanes */}
          {layout.lanes.map((lane, index) => (
            <div
              key={lane.key}
              aria-hidden
              className={cn('absolute inset-x-0 border-t border-border', index % 2 === 1 && 'bg-muted/40')}
              style={{ top: g.header + index * g.laneHeight, height: g.laneHeight }}
            >
              <div className="flex h-full items-center px-3" style={{ width: g.gutter }}>
                {lane.isAgent ? (
                  <span className="flex flex-col items-start gap-1">
                    <AgentBadge shortName={agent.shortName} color={agent.color} />
                    <span className="text-[11px] text-muted-foreground">the agent</span>
                  </span>
                ) : (
                  <span className="text-xs leading-tight font-medium">{lane.label}</span>
                )}
              </div>
            </div>
          ))}

          {/* Skill names across the top */}
          {layout.skills.map((span) => {
            const left = g.gutter + span.firstColumn * g.columnWidth;
            const width = (span.lastColumn - span.firstColumn + 1) * g.columnWidth;
            const content = <span className="truncate">{span.name}</span>;
            return (
              <div
                key={span.skillId}
                className="absolute flex items-center border-r border-dashed border-border px-2 text-xs font-semibold"
                style={{ left, width, top: 0, height: g.header }}
              >
                {hrefForSkill ? (
                  <Link href={hrefForSkill(span.skillId)} className="truncate text-primary hover:underline">
                    {span.name}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}

          {/* Connectors */}
          <svg aria-hidden className="pointer-events-none absolute inset-0" width={size.width} height={size.height}>
            <defs>
              <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" className="fill-muted-foreground" />
              </marker>
            </defs>
            {layout.edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              return (
                <path
                  key={`${edge.from}->${edge.to}`}
                  d={edgePath(nodeBox(from), nodeBox(to))}
                  fill="none"
                  className="stroke-muted-foreground"
                  strokeWidth={1.25}
                  strokeDasharray={edge.style === 'dashed' ? '5 4' : undefined}
                  markerEnd="url(#flow-arrow)"
                />
              );
            })}
          </svg>

          {/* Boxes, in flow order, so a screen reader reads them as a list */}
          <ol className="absolute inset-0">
            {layout.nodes.map((node) => {
              const box = nodeBox(node);
              const mark = marks?.get(node.id);
              const laneLabel = layout.lanes[node.lane].label;
              return (
                <li
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  aria-label={describe(node, laneLabel)}
                  aria-current={lit === node.id ? 'step' : undefined}
                  className={cn(
                    'absolute flex flex-col gap-1 overflow-hidden rounded-lg border p-2 text-xs shadow-sm transition-all',
                    node.kind === 'start'
                      ? 'border-transparent bg-foreground text-background'
                      : node.isApproval
                        ? 'border-warning bg-warning/15'
                        : 'border-border bg-card',
                    lit === node.id && 'z-10 scale-105 ring-2 ring-primary ring-offset-2 ring-offset-background',
                    lit && lit !== node.id && 'opacity-50',
                  )}
                  style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase opacity-80">
                    {node.kind === 'start' ? 'Starts' : `Step ${node.number}`}
                    {node.isApproval && <span>· Approval</span>}
                    {mark && (
                      <span
                        className={cn(
                          'ml-auto rounded px-1 normal-case',
                          mark === 'new' ? 'bg-success/25 text-foreground' : 'bg-primary/20 text-foreground',
                        )}
                      >
                        {mark === 'new' ? 'New' : 'Changed'}
                      </span>
                    )}
                  </span>
                  <span className={cn('line-clamp-3 leading-snug', !node.text && 'italic opacity-60')}>
                    {node.text || (node.kind === 'start' ? 'What starts it?' : 'Describe this step')}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {layout.alongside.length > 0 && (
        <p className="text-xs text-muted-foreground">
          ↻ Runs alongside every skill:{' '}
          {layout.alongside.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ', '}
              {hrefForSkill ? (
                <Link href={hrefForSkill(s.id)} className="text-primary hover:underline">
                  {s.name}
                </Link>
              ) : (
                s.name
              )}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
