export type Language = 'csharp' | 'javascript' | 'typescript' | 'python';

export type TargetType = 'po';

export interface Target {
  type: TargetType;
  languages: Language[];
  sourceDirs: string[];
  poDirs: string[];
  funcNames: string[];
}

export interface Settings {
  targets: Target[];
  wasmCdnBaseURL: string;
}

export const DEFAULT_WASM_CDN = 'https://unpkg.com/tree-sitter-wasms@latest/out/';

const DEFAULT_TARGET: Target = {
  type: 'po',
  languages: ['csharp'],
  sourceDirs: ['.'],
  poDirs: ['./l10n'],
  funcNames: []
};

export function normalizeTarget(raw: any): Target {
  return {
    type: raw?.type === 'po' ? 'po' : DEFAULT_TARGET.type,
    languages: Array.isArray(raw?.languages) && raw.languages.length ? raw.languages : DEFAULT_TARGET.languages,
    sourceDirs: Array.isArray(raw?.sourceDirs) && raw.sourceDirs.length ? raw.sourceDirs : DEFAULT_TARGET.sourceDirs,
    poDirs: Array.isArray(raw?.poDirs) && raw.poDirs.length ? raw.poDirs : DEFAULT_TARGET.poDirs,
    funcNames: Array.isArray(raw?.funcNames) && raw.funcNames.length ? raw.funcNames : DEFAULT_TARGET.funcNames
  };
}

export function normalizeTargets(rawTargets: any[] | undefined): Target[] {
  if (!Array.isArray(rawTargets)) { return []; }
  return rawTargets.map(normalizeTarget);
}

export const DEFAULT_SETTINGS: Settings = {
  targets: [],
  wasmCdnBaseURL: DEFAULT_WASM_CDN
};
