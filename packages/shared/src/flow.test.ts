import { describe, expect, it } from 'vitest';
import { edgePath, layoutFlow, nodeBox, type FlowSkillInput } from './flow';

const MANAGER = 'role-manager';
const FINANCE = 'role-finance';
const names: Record<string, string> = { [MANAGER]: 'Line manager', [FINANCE]: 'Finance' };
const options = { agentLabel: 'PLA', roleName: (id: string) => names[id] ?? id };

function skill(id: string, overrides: Partial<FlowSkillInput> = {}): FlowSkillInput {
  return {
    id,
    name: `Skill ${id}`,
    startedByRoleId: null,
    trigger: 'Start of month',
    runsAlongside: false,
    steps: [
      { id: `${id}-1`, roleId: null, text: 'Drafts', isApproval: false },
      { id: `${id}-2`, roleId: MANAGER, text: 'Approves', isApproval: true },
    ],
    ...overrides,
  };
}

describe('layoutFlow', () => {
  it('puts the agent first and roles in order of first appearance', () => {
    const layout = layoutFlow(
      [skill('a', { steps: [{ roleId: FINANCE, text: 'Pays', isApproval: false }, { roleId: MANAGER, text: 'Signs', isApproval: true }] })],
      options,
    );
    expect(layout.lanes.map((l) => l.label)).toEqual(['PLA', 'Finance', 'Line manager']);
  });

  it('gives every node its own column, in order, and links each step to the next', () => {
    const layout = layoutFlow([skill('a')], options);
    expect(layout.nodes.map((n) => [n.kind, n.column, n.lane])).toEqual([
      ['start', 0, 0],
      ['step', 1, 0],
      ['step', 2, 1],
    ]);
    expect(layout.edges).toEqual([
      { from: 'a:start', to: 'a:a-1', style: 'solid' },
      { from: 'a:a-1', to: 'a:a-2', style: 'solid' },
    ]);
  });

  it('joins skills the agent starts by itself with a dashed hand-over', () => {
    const layout = layoutFlow([skill('a'), skill('b'), skill('c', { startedByRoleId: MANAGER })], options);
    const dashed = layout.edges.filter((e) => e.style === 'dashed');
    expect(dashed).toEqual([{ from: 'a:a-2', to: 'b:start', style: 'dashed' }]);
    expect(layout.skills.map((s) => [s.firstColumn, s.lastColumn])).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
  });

  it('keeps runs-alongside skills out of the chain', () => {
    const layout = layoutFlow([skill('a'), skill('rules', { runsAlongside: true, name: 'Stop rules' })], options);
    expect(layout.alongside).toEqual([{ id: 'rules', name: 'Stop rules' }]);
    expect(layout.nodes.every((n) => n.skillId === 'a')).toBe(true);
  });

  it('draws a 40-step flow with no two nodes overlapping', () => {
    const steps = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      roleId: i % 3 === 0 ? null : i % 3 === 1 ? MANAGER : FINANCE,
      text: `Step ${i}`,
      isApproval: i % 3 === 1,
    }));
    const layout = layoutFlow([skill('big', { steps })], options);
    const boxes = layout.nodes.map((n) => nodeBox(n));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
    expect(layout.columns).toBe(41);
  });

  it('routes a lane change through the gap between columns', () => {
    const from = nodeBox({ lane: 0, column: 0 });
    const to = nodeBox({ lane: 1, column: 1 });
    const path = edgePath(from, to);
    const midX = Number(path.split('H')[1].split('V')[0]);
    expect(midX).toBeGreaterThan(from.x + from.width);
    expect(midX).toBeLessThan(to.x);
  });
});
