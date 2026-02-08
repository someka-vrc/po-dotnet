import { defineConfig } from "@vscode/test-cli";
import * as path from "path";
import * as fs from "fs/promises";

const dateStr = new Date().toISOString().slice(0, 10);
const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
async function copyFixture(fixtureName) {
  const fixturesRoot = path.join(
    process.cwd(),
    "src/test/fixtures/workspaces",
    fixtureName,
  );
  const fixturesDest = path.join(
    process.cwd(),
    ".tmp",
    dateStr,
    `${fixtureName}-${timeStr}`,
  );
  await fs.mkdir(fixturesDest, { recursive: true });
  await fs.cp(fixturesRoot, fixturesDest, { recursive: true });
  return fixturesDest;
}

const test = (await fs.readdir("src/test/integration"))
  .filter((name) => name.endsWith(".test.ts"))
  .map(async (fn) => {
    const testName = fn.slice(0, -8); // remove .test.ts
    return {
      label: "integration",
      files: path.join(process.cwd(), "out/test/integration", fn.replace(".ts", ".js")),
      // VS Codeの起動オプションを追加
      launchArgs: [await copyFixture(`it-${testName}`)],
      mocha: {
        ui: "tdd",
        timeout: 20000,
      },
    };
  });

const configs = await Promise.all(test);
export default defineConfig(configs);
