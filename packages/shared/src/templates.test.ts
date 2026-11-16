import { describe, expect, it } from 'vitest';
import { agentInputSchema } from './agents';
import { skillContentSchema, skillReadiness } from './skills';
import { TEMPLATES, findTemplate, templateRoles, templateSkillCount } from './templates';

describe('starter templates', () => {
  it('has five templates with unique keys', () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(5);
    expect(findTemplate('finance')?.agent.shortName).toBe('FIN');
    expect(findTemplate('nope')).toBeUndefined();
  });

  it.each(TEMPLATES.map((t) => [t.key, t] as const))('%s is valid and every skill is ready', (_key, template) => {
    expect(agentInputSchema.safeParse(template.agent).success).toBe(true);
    expect(templateSkillCount(template)).toBeGreaterThanOrEqual(3);
    const roleId = (name: string | null) => (name ? '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f' : null);
    for (const capability of template.capabilities) {
      for (const skill of capability.skills) {
        const content = {
          name: skill.name,
          startedByRoleId: roleId(skill.startedBy),
          trigger: skill.trigger,
          steps: skill.steps.map((s) => ({ roleId: roleId(s.by), text: s.text, isApproval: s.isApproval ?? false, ifNo: s.ifNo ?? '' })),
          inputs: skill.inputs,
          channels: [],
          deliverable: skill.deliverable,
          humanControl: skill.humanControl,
          runsAlongside: skill.runsAlongside ?? false,
        };
        expect(skillContentSchema.safeParse(content).success).toBe(true);
        expect(skillReadiness(content).filter((c) => !c.ok)).toEqual([]);
      }
    }
  });

  it('lists the roles a template needs', () => {
    expect(templateRoles(findTemplate('people')!)).toEqual(['People team', 'Line manager']);
  });
});
