// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const rulesText = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(readFileSync(resolve(ROOT, 'firebase-blueprint.json'), 'utf8')) as {
  entities: Record<
    string,
    {
      properties: Record<string, { enum?: string[] }>;
      required: string[];
    }
  >;
};
const securitySpec = readFileSync(resolve(ROOT, 'security_spec.md'), 'utf8');

function extractRuleKeys(fnName: string, matcher: 'hasAll' | 'hasOnly'): string[] {
  const fnIdx = rulesText.indexOf(`function ${fnName}(`);
  expect(fnIdx).toBeGreaterThan(-1);
  const block = rulesText.slice(fnIdx, fnIdx + 4500);
  const re = new RegExp(`data\\.keys\\(\\)\\.${matcher}\\(\\[([\\s\\S]*?)\\]\\)`);
  const m = block.match(re);
  expect(m, `Could not find ${matcher} inside ${fnName}`).not.toBeNull();
  return [...m![1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

describe('Firestore Security Rules & Blueprint Contract', () => {
  it('enforces rules_version 2, global default-deny catch-all, verified email, and zero deletes', () => {
    expect(rulesText).toContain("rules_version = '2';");
    expect(rulesText).toMatch(/match \/\{document=\*\*\}[\s\S]*?allow read, write:\s*if false;/);
    expect(rulesText).toContain('request.auth.token.email_verified == true');

    const deleteMatches = rulesText.match(/allow delete:\s*if false;/g) ?? [];
    expect(deleteMatches.length).toBeGreaterThanOrEqual(4);
    expect(rulesText).not.toMatch(/allow delete:\s*if true/);
    expect(rulesText).not.toContain('JSON.stringify');
  });

  it('maintains strict 1-to-1 field schema parity between firebase-blueprint.json and firestore.rules', () => {
    const checks: Array<{ entity: string; fn: string }> = [
      { entity: 'LeaderboardEntry', fn: 'isValidLeaderboardEntry' },
      { entity: 'DailyChallengeEntry', fn: 'isValidDailyChallengeEntry' },
      { entity: 'MultiplayerRoom', fn: 'isValidRoom' },
      { entity: 'MultiplayerActionIntent', fn: 'isValidActionIntent' }
    ];

    for (const { entity, fn } of checks) {
      const schemaRequired = blueprint.entities[entity].required;
      const schemaProps = Object.keys(blueprint.entities[entity].properties);
      expect(schemaRequired).toEqual(schemaProps);

      expect(extractRuleKeys(fn, 'hasAll')).toEqual(schemaRequired);
      expect(extractRuleKeys(fn, 'hasOnly')).toEqual(schemaRequired);
    }
  });

  it('enforces all 18 multiplayer action types, rulesetMode immutability, and terminal FINISHED lock', () => {
    const blueprintActions = blueprint.entities.MultiplayerActionIntent.properties.actionType.enum ?? [];
    expect(blueprintActions).toHaveLength(18);
    for (const act of blueprintActions) {
      expect(rulesText).toContain(`'${act}'`);
    }

    expect(rulesText).toContain("existing().status != 'FINISHED'");
    expect(rulesText).toContain('incoming().rulesetMode == existing().rulesetMode');
    expect(rulesText).toContain('incoming().hostUid == existing().hostUid');
    expect(rulesText).toContain('data.recentChats.size() <= 8');
    expect(rulesText).toContain('request.query.limit != null');
    expect(rulesText).toContain('incoming().updatedAt == request.time');
    expect(securitySpec).toContain('Adversarial "Dirty Dozen" Payloads');
  });
});
