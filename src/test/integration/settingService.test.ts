import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { SettingsService } from "../../services/settingsService";
import { DEFAULT_SETTINGS } from "../../models/settings";

suite("Setting Service Test Suite", () => {
  vscode.window.showInformationMessage(
    "Start SettingService integration tests.",
  );

  function withTestTimeout<T>(p: Promise<T>, ms = 30_000, msg?: string) {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(msg ?? `Test timed out after ${ms}ms`)),
          ms,
        ),
      ),
    ]);
  }

  test("loads settings from po-support.json file", async () => {
    await withTestTimeout(
      (async () => {
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(
          wsFolder,
          "Workspace folder is available for integration tests",
        );
        const root = wsFolder!.uri.fsPath;
        const srcFixture = path.join(root, "po-support.initial.json");
        const target = path.join(root, "po-support.json");

        // copy initial fixture to workspace root
        await fs.copyFile(srcFixture, target);

        const service = new SettingsService(vscode.workspace);
        try {
          await service.init();

          // reload to ensure file is read
          await service.reload();

          const settings = service.getSettings();
          assert.strictEqual(
            settings.wasmCdnBaseURL,
            DEFAULT_SETTINGS.wasmCdnBaseURL,
          );
          assert.ok(Array.isArray(settings.targets));
          assert.strictEqual(settings.targets.length, 1);
          assert.deepStrictEqual(settings.targets[0].languages, ["javascript"]);
        } finally {
          service.dispose();

          // cleanup
          await fs.unlink(target);
        }
      })(),
      30_000,
    );
  });

  test("merges configuration targets with file targets (config first)", async () => {
    await withTestTimeout(
      (async () => {
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(wsFolder);
        const root = wsFolder!.uri.fsPath;
        const srcFixture = path.join(root, "po-support.initial.json");
        const target = path.join(root, "po-support.json");

        await fs.copyFile(srcFixture, target);

        const service = new SettingsService(vscode.workspace);
        try {
          await service.init();

          // set workspace configuration targets
          const configTargets = [
            {
              languages: ["typescript"],
              sourceDirs: ["ts"],
              poDirs: ["locales"],
              funcNames: [],
            },
          ];
          await vscode.workspace
            .getConfiguration("po-support")
            .update(
              "targets",
              configTargets,
              vscode.ConfigurationTarget.Workspace,
            );

          // reload and assert merge order (config first)
          await service.reload();
          const settings = service.getSettings();
          assert.strictEqual(settings.targets.length, 2);
          assert.deepStrictEqual(settings.targets[0].languages, ["typescript"]);
          assert.deepStrictEqual(settings.targets[1].languages, ["javascript"]);
        } finally {
          // cleanup
          await vscode.workspace
            .getConfiguration("po-support")
            .update("targets", undefined, vscode.ConfigurationTarget.Workspace);
          service.dispose();
          await fs.unlink(target);
        }
      })(),
      30_000,
    );
  });

  test("file changes trigger reload and onDidChange listeners", async () => {
    await withTestTimeout(
      (async () => {
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(wsFolder);
        const root = wsFolder!.uri.fsPath;
        const initial = path.join(root, "po-support.initial.json");
        const updated = path.join(root, "po-support.updated.json");
        const target = path.join(root, "po-support.json");

        // start with initial
        await fs.copyFile(initial, target);

        const service = new SettingsService(vscode.workspace);
        try {
          await service.init();

          // wait for initial read
          await service.reload();

          const changePromise = new Promise<void>((resolve, reject) => {
            const to = setTimeout(
              () => reject(new Error("Timeout waiting for change event")),
              10_000,
            );
            service.onDidChange((s) => {
              try {
                // 明示的なアサーションを追加
                assert.ok(
                  s.targets.length > 0 &&
                    s.targets[0].languages.includes("python"),
                );
                clearTimeout(to);
                resolve();
              } catch (e) {
                clearTimeout(to);
                reject(e);
              }
            });
          });

          // overwrite the file to trigger watcher
          await fs.copyFile(updated, target);

          // wait for change to be observed via listener (or watcher + reload)
          await changePromise;
        } finally {
          service.dispose();

          // cleanup
          await fs.unlink(target);
        }
      })(),
      30_000,
    );
  });
});