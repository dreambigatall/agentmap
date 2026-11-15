import { Prisma } from '@prisma/client';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the rule in schema.prisma: every model with a workspace_id column must be
 * filtered by the scoped client. Adding a table without listing it fails here.
 */
describe('workspace-scoped models', () => {
  it('lists every model that has a workspaceId', () => {
    const source = readFileSync(join(__dirname, 'prisma.service.ts'), 'utf8');
    const withWorkspace = Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === 'workspaceId'))
      .map((model) => model.name);

    expect(withWorkspace.length).toBeGreaterThan(5);
    const missing = withWorkspace.filter((name) => !source.includes(`Prisma.ModelName.${name}`));
    expect(missing).toEqual([]);
  });
});

/**
 * Every interactive transaction must pass TX_OPTIONS. Prisma's 5-second default cut
 * skill saves off midway against the hosted database (found in browser testing).
 */
describe('transaction time limits', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
    });
  }

  it('passes TX_OPTIONS to every $transaction with a callback', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(__dirname, '..'))) {
      const source = readFileSync(file, 'utf8');
      const calls = source.split('$transaction(async').length - 1;
      const withOptions = source.split('}, TX_OPTIONS)').length - 1;
      if (calls !== withOptions) offenders.push(`${file}: ${calls} transactions, ${withOptions} with TX_OPTIONS`);
    }
    expect(offenders).toEqual([]);
  });
});
