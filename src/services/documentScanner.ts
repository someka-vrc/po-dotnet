import * as vscode from "vscode";
import * as path from "path";
import { collectConfigObjectsForDocument } from "../config";
import { extractFirstStringArgumentRange } from "../utils";
import { POManager } from "./poManager";

export interface ScanHelpers {
  poManager: POManager;
  diagnostics: vscode.DiagnosticCollection;
  getReferences: (msgid: string, allowedSourceDirs?: string[]) => Array<{ uri: vscode.Uri; range: vscode.Range }>;
  scanDirs: (dirs: string[], cfgs?: { sourceDirs: string[]; poDirs: string[]; localizeFuncs: string[]; workspaceFolder: vscode.WorkspaceFolder | null }[]) => Promise<void>;
  docMsgids: Map<string, Array<{ range: vscode.Range; msgid: string }>>;
  scannedDocs: Set<string>;
  scanningDocs: Set<string>;
  scheduleComputeUnusedForWorkspace: (key: string, cfgs: { sourceDirs: string[]; poDirs: string[]; localizeFuncs: string[]; workspaceFolder: vscode.WorkspaceFolder }[]) => void;
}

export async function scanDocument(
  document: vscode.TextDocument,
  callerCfgs: { sourceDirs: string[]; poDirs: string[]; localizeFuncs: string[]; workspaceFolder: vscode.WorkspaceFolder | null }[] | undefined,
  helpers: ScanHelpers,
) {
  if (document.languageId !== "csharp") {
    return;
  }
  const uriStr = document.uri.toString();
  helpers.scanningDocs.add(uriStr);
  const text = document.getText();
  const ws = vscode.workspace.getWorkspaceFolder(document.uri);

  // Determine matching configs for this document so we can use only their poDirs and funcs
  let cfgObjs = await collectConfigObjectsForDocument(document.uri);
  const docPath = document.uri.fsPath;
  let matchedCfgs = cfgObjs.filter((c) =>
    c.sourceDirs.some((sd) => docPath === sd || docPath.startsWith(sd + path.sep)),
  );

  // If no config matches this document from its own config lookup, try caller-provided configs (targeted scan)
  if (matchedCfgs.length === 0 && callerCfgs && callerCfgs.length > 0) {
    matchedCfgs = callerCfgs.filter((c) =>
      c.sourceDirs.some((sd) => docPath === sd || docPath.startsWith(sd + path.sep)),
    );
  }

  // If no config matches this document from its own config lookup, log and try caller-provided configs already handled above.
  if (matchedCfgs.length === 0) {
    helpers.scanningDocs.delete(uriStr);
    return;
  }

  let funcs: string[] = [];
  {
    const set = new Set<string>();
    for (const c of matchedCfgs) {
      for (const f of c.localizeFuncs || []) {
        set.add(f);
      }
    }
    funcs = Array.from(set);
    if (!funcs || funcs.length === 0) {
      funcs = ["G"];
    }
  }

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
  const re = new RegExp(`\\b(?:${funcs.map(escapeRegExp).join("|")})\\b`, "g");
  let match: RegExpExecArray | null;
  const diags: vscode.Diagnostic[] = [];
  const entries: Array<{ range: vscode.Range; msgid: string }> = [];
  while ((match = re.exec(text)) !== null) {
    const matchIndex = match.index;
    let i = matchIndex + match[0].length;
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }
    if (i >= text.length || text[i] !== "(") {
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth--;
        if (depth === 0) {
          const inside = text.substring(i + 1, j);
          const arg = extractFirstStringArgumentRange(inside, i + 1);
          if (!arg) {
            break;
          }
          entries.push({
            range: new vscode.Range(document.positionAt(arg.start), document.positionAt(arg.end)),
            msgid: arg.msgid,
          });
          const msgid = arg.msgid;
          // restrict search to poDirs corresponding to this document; if none, skip (no fallback)
          const allowedPoDirs: string[] = [];
          for (const c of matchedCfgs) {
            for (const d of c.poDirs || []) {
              if (!allowedPoDirs.includes(d)) {
                allowedPoDirs.push(d);
              }
            }
          }
          if (allowedPoDirs.length === 0) {
            // no PO dirs associated with matched config — do not fallback to global search
            break;
          }
          const statuses = helpers.poManager.getEntryStatus(msgid, allowedPoDirs);
          if (statuses.length === 0) {
            break;
          }
          const missingList = statuses
            .filter((s) => !s.hasEntry || (s.translation !== undefined && s.translation.trim() === ""))
            .map((s) => s.relativePath);
          if (missingList.length > 0) {
            const startPos = document.positionAt(matchIndex);
            const endPos = document.positionAt(j + 1);
            const displayKey = msgid.replace(/\s+/g, " ").trim();
            const truncatedKey = displayKey.length > 16 ? displayKey.slice(0, 16) + "…" : displayKey;
            const message = `Missing PO entries for '${truncatedKey}': ${missingList.join(", ")}`;
            const diag = new vscode.Diagnostic(new vscode.Range(startPos, endPos), message, vscode.DiagnosticSeverity.Warning);
            diag.source = "po-dotnet";
            diags.push(diag);
          }
          break;
        }
      }
    }
  }
  if (diags.length > 0) {
    helpers.diagnostics.set(document.uri, diags);
  } else {
    helpers.diagnostics.delete(document.uri);
  }

  // store found msgids for this document so references can be resolved
  if (entries.length > 0) {
    helpers.docMsgids.set(uriStr, entries);
  } else {
    helpers.docMsgids.delete(uriStr);
  }

  // mark as scanned and clear scanning mark
  helpers.scannedDocs.add(uriStr);
  helpers.scanningDocs.delete(uriStr);

  // schedule unused PO diagnostics recomputation for the workspace(s) that matched this doc
  if (matchedCfgs.length > 0) {
    const key = ws && ws.uri ? ws.uri.toString() : "";
    // ensure workspaceFolder is non-null for the scheduled computation
    const safeCfgs = matchedCfgs
      .filter((c) => !!c.workspaceFolder)
      .map((c) => ({
        sourceDirs: c.sourceDirs,
        poDirs: c.poDirs,
        localizeFuncs: c.localizeFuncs,
        workspaceFolder: c.workspaceFolder as vscode.WorkspaceFolder,
      }));
    if (safeCfgs.length > 0) {
      helpers.scheduleComputeUnusedForWorkspace(key, safeCfgs);
    }
  }
}
