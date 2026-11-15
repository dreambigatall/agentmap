/**
 * Turns skills into a swimlane diagram: one lane per actor (the agent first, then
 * human roles in the order they first appear), one column per node, left to right.
 * Pure data in, pure data out, so the screen only draws and the rules can be tested.
 *
 * Used for one skill (its swimlane) and for a whole capability (the full flow).
 */

export interface FlowStepInput {
  id?: string;
  key?: string;
  roleId: string | null;
  text: string;
  isApproval: boolean;
}

export interface FlowSkillInput {
  id: string;
  name: string;
  startedByRoleId: string | null;
  trigger: string;
  runsAlongside: boolean;
  steps: FlowStepInput[];
}

export interface FlowLane {
  /** "agent" for the agent's lane, otherwise the role id. */
  key: string;
  label: string;
  isAgent: boolean;
}

export interface FlowNode {
  id: string;
  kind: 'start' | 'step';
  skillId: string;
  lane: number;
  column: number;
  text: string;
  isApproval: boolean;
  /** Step number within its skill, 1-based. Empty for the start node. */
  number: number | null;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** Solid inside a skill; dashed where the agent starts the next skill by itself. */
  style: 'solid' | 'dashed';
}

export interface FlowSkillSpan {
  skillId: string;
  name: string;
  firstColumn: number;
  lastColumn: number;
}

export interface FlowLayout {
  lanes: FlowLane[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  skills: FlowSkillSpan[];
  /** Skills that run alongside every other one; shown as a note, not in the chain. */
  alongside: Array<{ id: string; name: string }>;
  columns: number;
}

export const AGENT_LANE = 'agent';

export function layoutFlow(
  skills: FlowSkillInput[],
  options: { agentLabel: string; roleName: (roleId: string) => string },
): FlowLayout {
  const chain = skills.filter((s) => !s.runsAlongside);
  const alongside = skills.filter((s) => s.runsAlongside).map((s) => ({ id: s.id, name: s.name }));

  // Lanes: the agent always first, then each role the first time it appears.
  const lanes: FlowLane[] = [{ key: AGENT_LANE, label: options.agentLabel, isAgent: true }];
  const laneOf = new Map<string, number>([[AGENT_LANE, 0]]);
  const lane = (roleId: string | null): number => {
    const key = roleId ?? AGENT_LANE;
    if (!laneOf.has(key)) {
      laneOf.set(key, lanes.length);
      lanes.push({ key, label: options.roleName(key), isAgent: false });
    }
    return laneOf.get(key)!;
  };

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const spans: FlowSkillSpan[] = [];
  let column = 0;
  let previousLast: string | null = null;

  for (const skill of chain) {
    const firstColumn = column;
    const startId = `${skill.id}:start`;
    nodes.push({
      id: startId,
      kind: 'start',
      skillId: skill.id,
      lane: lane(skill.startedByRoleId),
      column: column++,
      text: skill.trigger,
      isApproval: false,
      number: null,
    });
    // The agent picks up the next skill by itself: draw the hand-over dashed.
    if (previousLast && skill.startedByRoleId === null) {
      edges.push({ from: previousLast, to: startId, style: 'dashed' });
    }

    let last = startId;
    skill.steps.forEach((step, index) => {
      const id = `${skill.id}:${step.id ?? step.key ?? index}`;
      nodes.push({
        id,
        kind: 'step',
        skillId: skill.id,
        lane: lane(step.roleId),
        column: column++,
        text: step.text,
        isApproval: step.isApproval,
        number: index + 1,
      });
      edges.push({ from: last, to: id, style: 'solid' });
      last = id;
    });

    spans.push({ skillId: skill.id, name: skill.name, firstColumn, lastColumn: column - 1 });
    previousLast = last;
  }

  return { lanes, nodes, edges, skills: spans, alongside, columns: column };
}

// ------------------------------------------------------------- geometry

export interface FlowGeometry {
  laneHeight: number;
  columnWidth: number;
  nodeWidth: number;
  nodeHeight: number;
  /** Space on the left for lane labels. */
  gutter: number;
  /** Space on top for skill names. */
  header: number;
}

export const DEFAULT_GEOMETRY: FlowGeometry = {
  laneHeight: 128,
  columnWidth: 196,
  nodeWidth: 168,
  nodeHeight: 92,
  gutter: 132,
  header: 36,
};

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodeBox(node: Pick<FlowNode, 'lane' | 'column'>, g: FlowGeometry = DEFAULT_GEOMETRY): NodeBox {
  return {
    x: g.gutter + node.column * g.columnWidth + (g.columnWidth - g.nodeWidth) / 2,
    y: g.header + node.lane * g.laneHeight + (g.laneHeight - g.nodeHeight) / 2,
    width: g.nodeWidth,
    height: g.nodeHeight,
  };
}

/**
 * An SVG path from one node to the next. Same lane: a straight line. Different lane:
 * out to the gap between the columns, up or down in that gap, then in. Lines never
 * cross a node because every column holds exactly one node.
 */
export function edgePath(from: NodeBox, to: NodeBox): string {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  if (startY === endY) return `M${startX} ${startY}H${endX}`;
  const midX = (startX + endX) / 2;
  return `M${startX} ${startY}H${midX}V${endY}H${endX}`;
}

export function flowSize(layout: Pick<FlowLayout, 'lanes' | 'columns'>, g: FlowGeometry = DEFAULT_GEOMETRY) {
  return {
    width: g.gutter + Math.max(layout.columns, 1) * g.columnWidth + 16,
    height: g.header + layout.lanes.length * g.laneHeight,
  };
}
