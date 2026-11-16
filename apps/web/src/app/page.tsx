import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_NAME, BrandMark } from '@/components/brand';
import { ButtonLink } from '@/components/ui/button';
import { DemoFlow } from '@/features/landing/demo-flow';

export const metadata: Metadata = {
  title: `${BRAND_NAME}: design the workflow before you build the agent`,
  description:
    'Map every step your AI agent will take, who does it and who approves it. Review it with your team and sign it off before any code is written.',
};

const STEPS = [
  {
    title: 'Map it',
    text: 'Write what starts the skill and each step after it. Say who does each one: the agent or a person. The diagram draws itself.',
  },
  {
    title: 'Review it',
    text: 'Comment on steps, request changes and see what changed between versions. A readiness check shows what is still missing.',
  },
  {
    title: 'Sign it off',
    text: 'The people who own the process approve it. Then share a link or export it, and build the agent from an agreed plan.',
  },
];

const TEMPLATES = ['People and HR', 'Finance', 'Sales', 'Customer support', 'Operations'];

/**
 * The public home page. Signed-in visitors never see it: the middleware sends them to their workspace.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} home`}>
          <BrandMark />
          <span className="text-base font-medium">{BRAND_NAME}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <ButtonLink href="/sign-in" variant="ghost">
            Sign in
          </ButtonLink>
          <ButtonLink href="/sign-up">Get started</ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="pt-12 pb-10 text-center sm:pt-20">
          <p className="font-mono text-xs tracking-widest text-primary uppercase">Workflow design for AI agents</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Agree what your AI agent does before you build it
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground">
            {BRAND_NAME} is where your team maps each step an agent will take, decides where a person approves, and
            signs the plan off. No code needed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/sign-up" size="lg">
              Start mapping
            </ButtonLink>
            <ButtonLink href="/sign-in" size="lg" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        </section>

        <section aria-labelledby="demo-heading" className="rounded-lg border border-border bg-card p-4 text-left sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="demo-heading" className="text-sm font-medium">
              Try it: a finance agent matching invoices
            </h2>
            <p className="text-xs text-muted-foreground">
              Yellow boxes are approvals. Press Play to walk through it.
            </p>
          </div>
          <DemoFlow />
        </section>

        <section aria-labelledby="how-heading" className="py-16">
          <h2 id="how-heading" className="text-center text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-border bg-card p-5">
                <span className="font-mono text-xs text-primary">0{index + 1}</span>
                <h3 className="mt-2 text-base font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="templates-heading" className="rounded-lg border border-border bg-card px-5 py-10 text-center">
          <h2 id="templates-heading" className="text-2xl font-semibold tracking-tight">
            Start from a template
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Each one comes with an agent and ready-made skills you can change to fit how your team works.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {TEMPLATES.map((name) => (
              <li key={name} className="rounded-md border border-border-strong bg-muted/60 px-3 py-1.5 text-sm">
                {name}
              </li>
            ))}
          </ul>
          <ButtonLink href="/sign-up" size="lg" className="mt-8">
            Create your workspace
          </ButtonLink>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 py-8 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {BRAND_NAME}
        </span>
        <Link href="/sign-in" className="hover:text-foreground">
          Sign in
        </Link>
      </footer>
    </div>
  );
}
