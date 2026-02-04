import * as vscode from "vscode";
import * as path from "path";

export async function collectConfigsForDocument(documentUri: vscode.Uri) {
  const ws = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!ws) {
    return {
      sourceDirs: [] as string[],
      poDirs: [] as string[],
      localizeFuncs: [] as string[],
      workspaceFolder: null,
    };
  }
  const sourceSet = new Set<string>();
  const poSet = new Set<string>();
  const localizeSet = new Set<string>();
  let dir = path.dirname(documentUri.fsPath);
  const wsRoot = ws.uri.fsPath;
  while (true) {
    for (const name of ["podotnetconfig.json", "podotnetconfig~.json"]) {
      const cfgUri = vscode.Uri.file(path.join(dir, name));
      try {
        const bytes = await vscode.workspace.fs.readFile(cfgUri);
        const content = new TextDecoder("utf-8").decode(bytes);
        const parsed = JSON.parse(content);
        const processCfg = (cfg: any) => {
          if (Array.isArray(cfg.sourceDirs)) {
            for (const s of cfg.sourceDirs) {
              const resolved = path.resolve(dir, s);
              sourceSet.add(resolved);
            }
          }
          if (Array.isArray(cfg.poDirs)) {
            for (const p of cfg.poDirs) {
              const resolved = path.resolve(dir, p);
              poSet.add(resolved);
            }
          }
          if (Array.isArray(cfg.localizeFuncs)) {
            for (const f of cfg.localizeFuncs) {
              if (typeof f === "string") {
                localizeSet.add(f);
              }
            }
          }
        };
        if (Array.isArray(parsed.config)) {
          for (const cfg of parsed.config) {
            processCfg(cfg);
          }
        } else {
          processCfg(parsed);
        }
      } catch (e) {
        // no config here or parse error -- ignore
      }
    }
    if (dir === wsRoot) {
      break;
    }
    const parent = path.dirname(dir);
    if (!parent || parent === dir) {
      break;
    }
    dir = parent;
  }
  return {
    sourceDirs: Array.from(sourceSet),
    poDirs: Array.from(poSet),
    localizeFuncs: Array.from(localizeSet),
    workspaceFolder: ws,
  };
}

export async function collectConfigObjectsForDocument(documentUri: vscode.Uri) {
  const ws = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!ws) {
    return [] as {
      sourceDirs: string[];
      poDirs: string[];
      localizeFuncs: string[];
      workspaceFolder: vscode.WorkspaceFolder | null;
    }[];
  }
  const configs: {
    sourceDirs: string[];
    poDirs: string[];
    localizeFuncs: string[];
    workspaceFolder: vscode.WorkspaceFolder | null;
  }[] = [];
  let dir = path.dirname(documentUri.fsPath);
  const wsRoot = ws.uri.fsPath;
  while (true) {
    for (const name of ["podotnetconfig.json", "podotnetconfig~.json"]) {
      const cfgUri = vscode.Uri.file(path.join(dir, name));
      try {
        const bytes = await vscode.workspace.fs.readFile(cfgUri);
        const content = new TextDecoder("utf-8").decode(bytes);
        const parsed = JSON.parse(content);
        const processCfg = (cfg: any) => {
          const sourceDirs: string[] = [];
          const poDirs: string[] = [];
          const localizeFuncs: string[] = [];
          if (Array.isArray(cfg.sourceDirs)) {
            for (const s of cfg.sourceDirs) {
              sourceDirs.push(path.resolve(dir, s));
            }
          }
          if (Array.isArray(cfg.poDirs)) {
            for (const p of cfg.poDirs) {
              poDirs.push(path.resolve(dir, p));
            }
          }
          if (Array.isArray(cfg.localizeFuncs)) {
            for (const f of cfg.localizeFuncs) {
              if (typeof f === "string") {
                localizeFuncs.push(f);
              }
            }
          }
          configs.push({ sourceDirs, poDirs, localizeFuncs, workspaceFolder: ws });
        };
        if (Array.isArray(parsed.config)) {
          for (const cfg of parsed.config) {
            processCfg(cfg);
          }
        } else {
          processCfg(parsed);
        }
      } catch (e) {
        // no config here or parse error -- ignore
      }
    }
    if (dir === wsRoot) {
      break;
    }
    const parent = path.dirname(dir);
    if (!parent || parent === dir) {
      break;
    }
    dir = parent;
  }
  return configs;
}
