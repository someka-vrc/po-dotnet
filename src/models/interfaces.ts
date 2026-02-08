import { Uri, GlobPattern, ConfigurationChangeEvent } from 'vscode';

export interface IDisposable {
  dispose(): void;
}

export interface IConfiguration {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: any): Thenable<void>;
}
export interface IFileSystemWatcher {
  onDidCreate(listener: (uri: Uri) => void): IDisposable;
  onDidChange(listener: (uri: Uri) => void): IDisposable;
  onDidDelete(listener: (uri: Uri) => void): IDisposable;
  dispose(): void;
}

/**
 * テストのために vscode.workspace を抽象化したインターフェース
 * node_modules\@types\vscode\index.d.ts の namespace workspace と整合していなくてはならない
 */
export interface IWorkspace {
  getConfiguration(section?: string): IConfiguration;
  findFiles(include: GlobPattern, exclude?: GlobPattern | null, maxResults?: number): Thenable<Uri[]>;
  createFileSystemWatcher(pattern: GlobPattern): IFileSystemWatcher;
  onDidChangeConfiguration(listener: (e: ConfigurationChangeEvent) => void): IDisposable;
}

/**
 * テストのために vscode.window を抽象化したインターフェース
 * node_modules\@types\vscode\index.d.ts の namespace window と整合していなくてはならない
 */
export interface IWindow {
  showInformationMessage(message: string): Thenable<string | undefined>;
  showErrorMessage(message: string): Thenable<string | undefined>;
}