'use client';

import { layoutFlow, type FlowSkillInput } from '@skillflow/shared';
import { FlowDiagram } from '@/features/flow/flow-diagram';

/** The "Invoice matching" skill from the Finance starter template, with a made-up role id. */
const FINANCE = 'finance';

const SKILLS: FlowSkillInput[] = [
  {
    id: 'invoice-matching',
    name: 'Invoice matching',
    startedByRoleId: null,
    trigger: 'A supplier invoice arrives in the invoices inbox',
    runsAlongside: false,
    steps: [
      { key: 's1', roleId: null, text: 'Reads the invoice and finds its purchase order and delivery note', isApproval: false },
      { key: 's2', roleId: null, text: 'Checks amounts, quantities and tax match within the tolerance', isApproval: false },
      { key: 's3', roleId: FINANCE, text: 'Approves the payment, or resolves the mismatch', isApproval: true },
      { key: 's4', roleId: null, text: 'Schedules the payment for the next payment run', isApproval: false },
    ],
  },
];

const LAYOUT = layoutFlow(SKILLS, { agentLabel: 'FIN', roleName: () => 'Finance' });

/** The real flow diagram, drawing a sample skill, so visitors see the product before signing up. */
export function DemoFlow() {
  return (
    <FlowDiagram
      layout={LAYOUT}
      agent={{ shortName: 'FIN', color: 'amber' }}
      label="Example flow: invoice matching by a finance agent"
    />
  );
}
