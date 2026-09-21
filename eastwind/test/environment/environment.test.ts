import { describe, test } from "vitest";
import { generateTestEnvironment } from "./generateEnvironment";
import { hasDb } from "./testDatabase";

// The one test that BUILDS the database every
// other suite starts from: total generation, schema initialize, roles + AuthRules.xml, the seed data,
// then UserAssets.xml, all inside a snapshot the browser suite rewinds to before each test.
//
// DESTRUCTIVE — it drops and recreates the database it is pointed at, so it NEVER runs by accident. The
// flag below is set by one script and nothing else (`pnpm --filter eastwind gen:environment <env>`); a
// plain `test <env>` run, or a click in the Test Explorer, skips it.
//
// Deliberately NOT the test/destructive.env mechanism @altea/altea uses. There the config loads that file
// for any sequential run, which is every run — fine when the database is a disposable test fixture, and
// very much not fine here, where `.env.local` is the database you develop against.
//
// The same body is also the `gen:environment` script, so there is exactly one definition of what the test
// environment IS — whichever way you invoke it.
const canGenerate = hasDb && process.env["EASTWIND_TEST_DESTRUCTIVE"] === "1";

describe.skipIf(!canGenerate)("EnvironmentTest", () => {
    // Generation runs the whole seed — well past vitest's default timeouts.
    test("GenerateTestEnvironment", { timeout: 600_000 }, async () => {
        await generateTestEnvironment();
    });
});
