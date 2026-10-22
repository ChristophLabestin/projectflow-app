import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { FIXTURE_MODULES, runFixture } from '../fixtureRunners';

// Golden fixtures shared with the iOS PFDomain XCTests (shared/fixtures/README.md).
// Regenerate with `node shared/fixtures/generate.mjs` after an intentional logic change.
const FIXTURE_ROOT = path.resolve(__dirname, '../../../shared/fixtures');

interface Fixture {
    name: string;
    input: unknown;
    expected: unknown;
}

const loadFixtures = (module: string) => {
    const dir = path.join(FIXTURE_ROOT, module);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => ({ file, fixture: JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Fixture }));
};

describe('golden fixtures', () => {
    it('only contains known module folders', () => {
        const folders = readdirSync(FIXTURE_ROOT, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
        expect(folders).toEqual([...FIXTURE_MODULES].sort());
    });

    FIXTURE_MODULES.forEach((module) => {
        describe(module, () => {
            const fixtures = loadFixtures(module);

            it('has fixtures', () => {
                expect(fixtures.length).toBeGreaterThan(0);
            });

            fixtures.forEach(({ file, fixture }) => {
                it(`${file}: ${fixture.name}`, () => {
                    expect(Object.keys(fixture).sort()).toEqual(['expected', 'input', 'name']);
                    // Fixtures are plain JSON: compare after a JSON round trip so
                    // `undefined` fields behave like absent keys.
                    const actual = JSON.parse(JSON.stringify(runFixture(module, JSON.parse(JSON.stringify(fixture.input)))));
                    expect(actual).toEqual(fixture.expected);
                });
            });
        });
    });
});
