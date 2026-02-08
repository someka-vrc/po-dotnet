import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

export type TempDir = {
  path: string;
  dispose: () => Promise<void>;
};
export async function createTempDir(testId: string): Promise<TempDir> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
  const tempDir = path.join(
    process.cwd(),
    ".tmp",
    dateStr,
    `ut-${testId}-${timeStr}`,
  );
  await fs.mkdir(tempDir, { recursive: true });
  console.log(`Created temp dir for unit test "${testId}" at "${tempDir}"`);
  return {
    path: tempDir,
    dispose: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}
