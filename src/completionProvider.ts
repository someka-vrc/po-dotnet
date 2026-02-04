import * as vscode from "vscode";
import * as path from "path";
import { LocalizationChecker } from "./localizationChecker";
import { POManager } from "./poManager";
import { isInComment } from "./utils";
import { collectConfigsForDocument, collectConfigObjectsForDocument } from "./config";

function escapeForCSharpLiteral(s: string, verbatim: boolean) {
  if (verbatim) {
    // In verbatim strings, double quotes are escaped by doubling them
    return s.replace(/"/g, '""');
  }
  // normal string: escape backslash and double quote
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function registerCompletionProvider(
  context: vscode.ExtensionContext,
  localizationChecker: LocalizationChecker,
  poManager: POManager,
) {
  return vscode.languages.registerCompletionItemProvider(
    "csharp",
    {
      async provideCompletionItems(document, position, token, completionContext) {
        const text = document.getText();
        const offset = document.offsetAt(position);

        if (isInComment(text, offset)) {
          return undefined;
        }

        // detect if we're inside first string argument of a localization function
        // find the nearest preceding unescaped quote
        let i = offset - 1;
        let quoteIndex = -1;
        let verbatim = false;
        while (i >= 0) {
          const ch = text[i];
          if (ch === '"') {
            // check escaped (for normal strings) - if previous char is backslash, it's escaped
            // for verbatim strings, escape is by doubling, we'll consider both below
            // Decide verbatim if previous char is @
            if (i - 1 >= 0 && text[i - 1] === '@') {
              verbatim = true;
              quoteIndex = i;
              break;
            }
            // If previous char is backslash, it's escaped, skip
            if (i - 1 >= 0 && text[i - 1] === '\\') {
              i -= 2;
              continue;
            }
            quoteIndex = i;
            break;
          }
          i--;
        }
        if (quoteIndex === -1) {
          return undefined;
        }

        // ensure there is no comma between '(' and the quote (i.e., first argument)
        // find the opening paren before quote
        let parenIndex = -1;
        i = quoteIndex - 1;
        let depth = 0;
        while (i >= 0) {
          const ch = text[i];
          if (ch === ')') {
            depth++;
          } else if (ch === '(') {
            if (depth === 0) {
              parenIndex = i;
              break;
            }
            depth--;
          }
          i--;
        }
        if (parenIndex === -1) {
          return undefined;
        }

        // check between parenIndex+1 and quoteIndex there is no comma
        const between = text.substring(parenIndex + 1, quoteIndex);
        if (between.indexOf(',') !== -1) {
          return undefined; // not first argument
        }

        // find function name before paren
        i = parenIndex - 1;
        while (i >= 0 && /\s/.test(text[i])) {
          i--;
        }
        if (i < 0) {
          return undefined;
        }
        const end = i + 1;
        // function name chars: word chars (_ allowed)
        while (i >= 0 && /[A-Za-z0-9_]/.test(text[i])) {
          i--;
        }
        const start = i + 1;
        const funcName = text.substring(start, end);
        if (!funcName) {
          return undefined;
        }

        const cfgObjs = await collectConfigObjectsForDocument(document.uri);
        if (cfgObjs.length === 0) {
          return undefined;
        }
        const docPath = document.uri.fsPath;
        const matched = cfgObjs.filter((c) =>
          c.sourceDirs.some((sd) => docPath === sd || docPath.startsWith(sd + path.sep)),
        );
        if (matched.length === 0) {
          return undefined;
        }
        const funcsSet = new Set<string>();
        for (const c of matched) {
          for (const f of c.localizeFuncs || []) {
            funcsSet.add(f);
          }
        }
        const funcs = funcsSet.size > 0 ? Array.from(funcsSet) : ["G"];
        if (!funcs.includes(funcName)) {
          return undefined;
        }

        // ensure PO dirs watched
        for (const c of matched) {
          await poManager.ensureDirs(c.poDirs, c.workspaceFolder);
        }
        const allowedPoDirs = Array.from(new Set(matched.flatMap((c) => c.poDirs)));

        // calculate prefix: from quoteIndex+1 to offset
        const prefixRaw = text.substring(quoteIndex + 1, offset);
        // For verbatim strings, quotes are represented as "" inside; we keep raw

        // collect msgids
        const msgids = poManager.getAllMsgids(allowedPoDirs);
        if (!msgids || msgids.size === 0) {
          return undefined;
        }

        function fuzzyScore(prefix: string, target: string): number | null {
          // both already expected to be lowercase
          if (prefix.length === 0) {
            // prefer shorter targets when no prefix
            return 10000 - target.length;
          }
          let ti = 0;
          const positions: number[] = [];
          for (let pi = 0; pi < prefix.length; pi++) {
            const ch = prefix[pi];
            ti = target.indexOf(ch, ti);
            if (ti === -1) {
              return null;
            }
            positions.push(ti);
            ti++;
          }
          const start = positions[0];
          const end = positions[positions.length - 1];
          const contiguity = end - start + 1 - prefix.length; // 0 means contiguous
          // Higher score is better
          const score = 10000 - start * 100 - contiguity * 20 - (target.length - prefix.length);
          return score;
        }

        const lowerPrefix = prefixRaw.toLowerCase();
        const scored: Array<{ item: vscode.CompletionItem; score: number }> = [];
        for (const id of Array.from(msgids)) {
          const lowerId = id.toLowerCase();
          const score = fuzzyScore(lowerPrefix, lowerId);
          if (score === null) {
            continue;
          }
          const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Text);
          const trans = poManager.getTranslations(id, allowedPoDirs);
          if (trans && trans.length > 0) {
            const parts: string[] = [];
            const md = new vscode.MarkdownString("", true);
            md.isTrusted = true;
            md.appendMarkdown("po-dotnet\n\n");
            for (const t of trans) {
              const fileName = path.basename(t.relativePath);
              let message = t.translation.replace(/`/g, "'").replace(/\r?\n/g, " ").trim();
              if (message.length > 160) {
                message = message.slice(0, 159) + "…";
              }
              const fileLink = `[${fileName}](command:po-dotnet.openPoEntry?${encodeURIComponent(JSON.stringify([t.uri.toString(), t.line]))})`;
              md.appendMarkdown(`- ${fileLink}: \`${message}\``);
              parts.push(`(${fileName}) ${message}`);
            }
            // keep a short one-line summary in detail, full list in documentation (Markdown)
            item.detail = parts[0] || undefined;
            item.documentation = md;
          }
          // Replace current typed content (from quote start to caret) with full id
          const escaped = escapeForCSharpLiteral(id, verbatim);
          item.insertText = escaped;
          // Set range to replace the current prefix
          const startPos = document.positionAt(quoteIndex + 1);
          const endPos = position;
          (item as any).range = new vscode.Range(startPos, endPos);
          // set sortText so higher score appears earlier
          (item as any).sortText = String(10000000 - Math.max(0, Math.floor(score)));
          scored.push({ item, score });
        }

        if (scored.length === 0) {
          return undefined;
        }

        scored.sort((a, b) => b.score - a.score);
        const items = scored.map((s) => s.item);
        return new vscode.CompletionList(items, true);
      },
    },
    '"',
  );
}
