import { layoutFlow, type FlowLayout, type FlowSkillInput, type NamedItem } from '@skillflow/shared';

/** Builds a layout with the workspace's role names and the agent's badge text. */
export function toLayout(skills: FlowSkillInput[], agentShortName: string, roles: NamedItem[]): FlowLayout {
  const names = new Map(roles.map((r) => [r.id, r.name]));
  return layoutFlow(skills, {
    agentLabel: agentShortName,
    roleName: (id) => names.get(id) ?? 'Unknown role',
  });
}
