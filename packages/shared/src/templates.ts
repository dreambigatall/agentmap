import { z } from 'zod';
import type { AgentColor } from './agents';
import type { InputNeed } from './skills';

/**
 * Starter templates: a ready-made agent with its capabilities and skills, so a new
 * workspace starts from a worked example instead of a blank page. Roles and channels
 * are names; applying a template creates any the workspace does not have yet.
 * Every template skill passes the readiness checks, so a team can review, adjust and
 * move it to Defined straight away.
 */
export interface TemplateStep {
  /** A role name, or null when the agent does the step. */
  by: string | null;
  text: string;
  isApproval?: boolean;
  ifNo?: string;
}

export interface TemplateSkill {
  name: string;
  /** A role name, or null when the agent starts it by itself. */
  startedBy: string | null;
  trigger: string;
  steps: TemplateStep[];
  inputs: Array<{ label: string; need: InputNeed }>;
  channels: Array<{ name: string; usage: string }>;
  deliverable: string;
  humanControl: string;
  runsAlongside?: boolean;
}

export interface Template {
  key: string;
  name: string;
  /** One sentence for the picker. */
  summary: string;
  agent: { shortName: string; fullName: string; description: string; color: AgentColor };
  capabilities: Array<{ name: string; skills: TemplateSkill[] }>;
}

export const TEMPLATES: Template[] = [
  {
    key: 'people',
    name: 'People and HR',
    summary: 'Onboards new hires, runs leave requests and prepares performance reviews.',
    agent: {
      shortName: 'PPL',
      fullName: 'People Agent',
      description: 'Takes the paperwork out of onboarding, leave and reviews. Managers and the People team decide.',
      color: 'teal',
    },
    capabilities: [
      {
        name: 'Onboarding',
        skills: [
          {
            name: 'New hire onboarding',
            startedBy: 'People team',
            trigger: 'A signed offer letter is uploaded',
            steps: [
              { by: null, text: 'Creates the onboarding checklist from the role and start date' },
              { by: null, text: 'Asks IT for a laptop and accounts, and Finance to add the person to payroll' },
              { by: 'Line manager', text: 'Confirms the first-week plan and a buddy', isApproval: true, ifNo: 'Agent reminds the manager after two days' },
              { by: null, text: 'Sends the welcome email with the first-day details' },
              { by: null, text: 'Checks every task is done the day before the start date and flags gaps to the People team' },
            ],
            inputs: [
              { label: 'Signed offer letter', need: 'required' },
              { label: 'Role and team', need: 'automatic' },
              { label: 'Start date', need: 'automatic' },
            ],
            channels: [
              { name: 'Email', usage: 'Welcome email to the new hire' },
              { name: 'Slack', usage: 'Task reminders to IT, Finance and the manager' },
            ],
            deliverable: 'A new hire with equipment, accounts, payroll and a first-week plan ready on day one',
            humanControl: 'The manager approves the first-week plan; the People team owns the offer and contract',
          },
        ],
      },
      {
        name: 'Leave and reviews',
        skills: [
          {
            name: 'Leave request',
            startedBy: null,
            trigger: 'An employee asks for time off',
            steps: [
              { by: null, text: 'Checks the leave balance and team calendar for clashes' },
              { by: 'Line manager', text: 'Approves or declines the leave', isApproval: true, ifNo: 'Agent tells the employee the reason and suggests other dates' },
              { by: null, text: 'Updates the balance and the shared calendar, and confirms to the employee' },
            ],
            inputs: [
              { label: 'Dates and type of leave', need: 'required' },
              { label: 'Leave balance', need: 'automatic' },
              { label: 'Team calendar', need: 'automatic' },
            ],
            channels: [{ name: 'Slack', usage: 'Request, approval and confirmation messages' }],
            deliverable: 'Approved or declined leave, with the balance and calendar updated',
            humanControl: 'Only the line manager approves leave',
          },
          {
            name: 'Performance review preparation',
            startedBy: 'People team',
            trigger: 'The review cycle opens',
            steps: [
              { by: null, text: 'Collects each person’s goals, results and peer feedback into one summary' },
              { by: 'Line manager', text: 'Writes the rating and comments', isApproval: true, ifNo: 'Agent asks for the missing parts before the deadline' },
              { by: 'People team', text: 'Checks ratings are consistent across teams', isApproval: true, ifNo: 'Sends the review back to the manager with notes' },
              { by: null, text: 'Shares the final review with the employee and books the conversation' },
            ],
            inputs: [
              { label: 'Goals for the period', need: 'automatic' },
              { label: 'Peer feedback', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Review packs and meeting invites' }],
            deliverable: 'A calibrated review for every person, shared and discussed',
            humanControl: 'People decide every rating; the agent never scores anyone',
          },
        ],
      },
    ],
  },
  {
    key: 'finance',
    name: 'Finance',
    summary: 'Matches supplier invoices, checks expense claims and prepares the month-end close.',
    agent: {
      shortName: 'FIN',
      fullName: 'Finance Agent',
      description: 'Does the matching and checking so Finance only handles exceptions and approvals.',
      color: 'amber',
    },
    capabilities: [
      {
        name: 'Payables',
        skills: [
          {
            name: 'Invoice matching',
            startedBy: null,
            trigger: 'A supplier invoice arrives in the invoices inbox',
            steps: [
              { by: null, text: 'Reads the invoice and finds its purchase order and delivery note' },
              { by: null, text: 'Checks amounts, quantities and tax match within the tolerance' },
              { by: 'Finance', text: 'Approves the payment, or resolves the mismatch', isApproval: true, ifNo: 'Agent asks the supplier for a corrected invoice' },
              { by: null, text: 'Schedules the payment for the next payment run' },
            ],
            inputs: [
              { label: 'Supplier invoice', need: 'required' },
              { label: 'Purchase orders', need: 'automatic' },
              { label: 'Delivery notes', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Questions to suppliers' }],
            deliverable: 'A matched, approved invoice scheduled for payment',
            humanControl: 'Finance approves every payment',
          },
          {
            name: 'Expense claim check',
            startedBy: null,
            trigger: 'An employee submits an expense claim',
            steps: [
              { by: null, text: 'Checks receipts against the expense policy and flags anything outside it' },
              { by: 'Line manager', text: 'Approves the claim', isApproval: true, ifNo: 'Agent returns the claim with the reason' },
              { by: 'Finance', text: 'Approves flagged items above the limit', isApproval: true, ifNo: 'Flagged items are removed from the claim' },
              { by: null, text: 'Adds the claim to the next payroll' },
            ],
            inputs: [
              { label: 'Receipts', need: 'required' },
              { label: 'Expense policy', need: 'automatic' },
            ],
            channels: [{ name: 'Slack', usage: 'Approval requests and status updates' }],
            deliverable: 'An approved claim added to payroll',
            humanControl: 'Managers and Finance approve; the agent only checks and flags',
          },
        ],
      },
      {
        name: 'Month-end close',
        skills: [
          {
            name: 'Month-end close preparation',
            startedBy: null,
            trigger: 'The last working day of the month',
            steps: [
              { by: null, text: 'Reconciles bank statements with the ledger and lists differences' },
              { by: null, text: 'Drafts accruals and prepayments from open contracts' },
              { by: 'Finance', text: 'Reviews and posts the journals', isApproval: true, ifNo: 'Agent corrects the drafts from the notes' },
              { by: null, text: 'Prepares the management accounts pack' },
            ],
            inputs: [
              { label: 'Bank statements', need: 'automatic' },
              { label: 'Open contracts', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Management accounts to leadership' }],
            deliverable: 'Reconciled books and a management accounts pack',
            humanControl: 'Finance posts every journal',
          },
        ],
      },
    ],
  },
  {
    key: 'sales',
    name: 'Sales',
    summary: 'Qualifies new leads, prepares proposals and hands won deals to delivery.',
    agent: {
      shortName: 'SLS',
      fullName: 'Sales Agent',
      description: 'Keeps the pipeline moving: research, follow-ups and paperwork. People own the relationship.',
      color: 'indigo',
    },
    capabilities: [
      {
        name: 'Pipeline',
        skills: [
          {
            name: 'Lead qualification',
            startedBy: null,
            trigger: 'A new lead fills in the contact form',
            steps: [
              { by: null, text: 'Researches the company and scores the lead against the ideal customer profile' },
              { by: null, text: 'Drafts a first reply with two meeting times' },
              { by: 'Account executive', text: 'Reviews and sends the reply, or marks the lead not a fit', isApproval: true, ifNo: 'Agent sends a polite decline and adds the lead to the newsletter' },
              { by: null, text: 'Logs the lead and next step in the CRM' },
            ],
            inputs: [
              { label: 'Contact form answers', need: 'automatic' },
              { label: 'Ideal customer profile', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Replies to the lead' }],
            deliverable: 'A qualified lead with a booked meeting, or a closed lead with a reason',
            humanControl: 'An account executive sends every first reply',
          },
          {
            name: 'Proposal preparation',
            startedBy: 'Account executive',
            trigger: 'A discovery call is done and the deal is worth proposing',
            steps: [
              { by: null, text: 'Drafts the proposal from the call notes and the pricing sheet' },
              { by: 'Sales manager', text: 'Approves the price and any discount', isApproval: true, ifNo: 'Agent revises the pricing from the notes' },
              { by: 'Account executive', text: 'Sends the proposal to the customer' },
              { by: null, text: 'Follows up if there is no reply after five working days' },
            ],
            inputs: [
              { label: 'Call notes', need: 'required' },
              { label: 'Pricing sheet', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Follow-ups' }],
            deliverable: 'An approved proposal in the customer’s hands',
            humanControl: 'The sales manager approves every price and discount',
          },
        ],
      },
      {
        name: 'Handover',
        skills: [
          {
            name: 'Won deal handover',
            startedBy: null,
            trigger: 'A deal is marked won in the CRM',
            steps: [
              { by: null, text: 'Builds the handover note: scope, contacts, promises and dates' },
              { by: 'Account executive', text: 'Confirms the handover note is complete', isApproval: true, ifNo: 'Agent asks for the missing details' },
              { by: null, text: 'Opens the project and introduces the delivery lead to the customer' },
            ],
            inputs: [
              { label: 'Signed contract', need: 'required' },
              { label: 'CRM deal record', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Introduction to the customer' }],
            deliverable: 'A project opened with a complete handover note',
            humanControl: 'The account executive confirms what was promised',
          },
        ],
      },
    ],
  },
  {
    key: 'support',
    name: 'Customer support',
    summary: 'Sorts incoming tickets, drafts answers and escalates what needs a specialist.',
    agent: {
      shortName: 'SUP',
      fullName: 'Support Agent',
      description: 'Answers the routine questions fast and gets the hard ones to the right person.',
      color: 'sky',
    },
    capabilities: [
      {
        name: 'Tickets',
        skills: [
          {
            name: 'Ticket triage',
            startedBy: 'Customer',
            trigger: 'A customer opens a ticket',
            steps: [
              { by: null, text: 'Reads the ticket, sets its category and urgency, and finds the customer’s plan' },
              { by: null, text: 'Drafts an answer from the help centre and past tickets' },
              { by: 'Support lead', text: 'Approves the answer for anything about billing or data', isApproval: true, ifNo: 'Support lead answers it personally' },
              { by: null, text: 'Sends the answer and closes the ticket after the customer confirms' },
            ],
            inputs: [
              { label: 'Help centre articles', need: 'automatic' },
              { label: 'Customer plan and history', need: 'automatic' },
            ],
            channels: [
              { name: 'Email', usage: 'Answers to the customer' },
              { name: 'In-app', usage: 'Ticket updates' },
            ],
            deliverable: 'A resolved ticket with the right category',
            humanControl: 'People approve anything about billing, refunds or customer data',
          },
          {
            name: 'Escalation to engineering',
            startedBy: null,
            trigger: 'A ticket looks like a bug',
            steps: [
              { by: null, text: 'Collects steps to reproduce, screenshots and the customer’s setup' },
              { by: 'Support lead', text: 'Confirms it is a bug and sets the priority', isApproval: true, ifNo: 'Ticket goes back to the support queue' },
              { by: null, text: 'Opens the bug report and links the ticket' },
              { by: null, text: 'Updates the customer when the fix ships' },
            ],
            inputs: [{ label: 'Customer ticket', need: 'required' }],
            channels: [{ name: 'Slack', usage: 'Alerts to the engineering channel' }],
            deliverable: 'A prioritised bug report linked to the customer ticket',
            humanControl: 'The support lead decides priority',
          },
        ],
      },
      {
        name: 'Feedback',
        skills: [
          {
            name: 'Weekly feedback digest',
            startedBy: null,
            trigger: 'Every Friday',
            steps: [
              { by: null, text: 'Groups the week’s tickets and survey comments into themes' },
              { by: 'Support lead', text: 'Checks the themes and adds context', isApproval: true, ifNo: 'Agent regroups from the notes' },
              { by: null, text: 'Sends the digest to the product team' },
            ],
            inputs: [
              { label: 'Closed tickets', need: 'automatic' },
              { label: 'Survey answers', need: 'automatic' },
            ],
            channels: [{ name: 'Slack', usage: 'Digest to the product channel' }],
            deliverable: 'A weekly digest of what customers asked for and struggled with',
            humanControl: 'The support lead signs off what the product team sees',
            runsAlongside: true,
          },
        ],
      },
    ],
  },
  {
    key: 'operations',
    name: 'Operations',
    summary: 'Handles purchase requests, supplier onboarding and contract renewals.',
    agent: {
      shortName: 'OPS',
      fullName: 'Operations Agent',
      description: 'Runs the buying process end to end, with budget holders deciding what gets bought.',
      color: 'violet',
    },
    capabilities: [
      {
        name: 'Purchasing',
        skills: [
          {
            name: 'Purchase request',
            startedBy: 'Team lead',
            trigger: 'Someone needs to buy something',
            steps: [
              { by: null, text: 'Checks the budget and finds approved suppliers and prices' },
              { by: 'Department manager', text: 'Approves the purchase', isApproval: true, ifNo: 'Agent tells the requester why and closes the request' },
              { by: 'Finance', text: 'Approves purchases above the spending limit', isApproval: true, ifNo: 'Request goes back to the manager' },
              { by: null, text: 'Raises the purchase order and sends it to the supplier' },
            ],
            inputs: [
              { label: 'What to buy and why', need: 'required' },
              { label: 'Department budget', need: 'automatic' },
            ],
            channels: [{ name: 'Slack', usage: 'Approval requests' }],
            deliverable: 'An approved purchase order sent to the supplier',
            humanControl: 'Budget holders approve every purchase',
          },
          {
            name: 'Supplier onboarding',
            startedBy: null,
            trigger: 'A purchase needs a supplier we have not used before',
            steps: [
              { by: null, text: 'Collects company details, bank details and insurance from the supplier' },
              { by: null, text: 'Runs the standard checks and lists any risks' },
              { by: 'Finance', text: 'Approves the supplier and their bank details', isApproval: true, ifNo: 'Agent asks the supplier for what is missing' },
            ],
            inputs: [{ label: 'Supplier details form', need: 'required' }],
            channels: [{ name: 'Email', usage: 'Requests to the supplier' }],
            deliverable: 'An approved supplier ready to receive orders',
            humanControl: 'Finance approves every new supplier and bank detail change',
          },
        ],
      },
      {
        name: 'Contracts',
        skills: [
          {
            name: 'Contract renewal',
            startedBy: null,
            trigger: 'A contract ends in 60 days',
            steps: [
              { by: null, text: 'Summarises usage, cost and issues over the contract' },
              { by: 'Department manager', text: 'Decides to renew, renegotiate or end it', isApproval: true, ifNo: 'Agent sends the notice to end the contract' },
              { by: null, text: 'Drafts the renewal or notice and tracks the signature' },
            ],
            inputs: [
              { label: 'Current contract', need: 'automatic' },
              { label: 'Usage and spend', need: 'automatic' },
            ],
            channels: [{ name: 'Email', usage: 'Messages to the supplier' }],
            deliverable: 'A renewed, renegotiated or ended contract before the end date',
            humanControl: 'The manager makes every renewal decision',
          },
        ],
      },
    ],
  },
];

export function findTemplate(key: string): Template | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/** Every role a template's skills name, in order of first use. */
export function templateRoles(template: Template): string[] {
  const names = new Set<string>();
  for (const capability of template.capabilities) {
    for (const skill of capability.skills) {
      if (skill.startedBy) names.add(skill.startedBy);
      for (const step of skill.steps) if (step.by) names.add(step.by);
    }
  }
  return [...names];
}

export function templateChannels(template: Template): string[] {
  const names = new Set<string>();
  for (const capability of template.capabilities) {
    for (const skill of capability.skills) for (const channel of skill.channels) names.add(channel.name);
  }
  return [...names];
}

export function templateSkillCount(template: Template): number {
  return template.capabilities.reduce((sum, c) => sum + c.skills.length, 0);
}

export const applyTemplateSchema = z.object({ key: z.string().min(1).max(40) });
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

// ------------------------------------------------------------- setup checklist

export const setupProgressSchema = z.object({
  hasAgent: z.boolean(),
  hasSkill: z.boolean(),
  hasTeammate: z.boolean(),
  hasSignoff: z.boolean(),
  hasShare: z.boolean(),
});
export type SetupProgress = z.infer<typeof setupProgressSchema>;
