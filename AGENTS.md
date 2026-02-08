## 会話ルール

- ユーザーに対して話すときは日本語を使うこと。（独り言は英語でも可）
- ワークスペースのエラーとリントエラーをチェックし、エラーがないことを確認してから作業を終えること。（エラーを残したままユーザーに完了報告をしてはならない）

## フォルダ構成

```
node_modules/           # 依存パッケージ。編集しても意味がない
out/                    # ビルド出力先。編集しても意味がない

src/
├── commands/           # コマンドハンドラー
│   └── xxxCommand.ts
├── constants/          # 定数
│   └── constants.ts
├── models/             # 型定義・インターフェース
│   ├── types.ts
│   └── interfaces.ts   # VS Code APIのインターフェース定義
├── providers/          # CompletionProvider, TreeViewProviderなど
│   └── xxxProvider.ts
├── services/           # ビジネスロジック
│   └── xxxService.ts
├── test/               # テストコード
│   ├── fixtures/       # テスト用の静的ファイル
│   ├── unit/           # 軽量な単体テスト（VS Code不要）
│   │   ├── mocks/      # ユニットテスト用のモック
│   │   │   └── vscode.ts   # vscodeモジュールのモック
│   │   └── xxx.test.ts 
│   └── integration/    # VS Codeインスタンスが必要
│       └── xxx.test.ts
├── utils/              # ヘルパー関数
└── extension.ts        # エントリーポイント

```

## 実装

- コードを適切に分離する。
  - 責任分離、関心事の分離を意識する。
  - テスタビリティを意識する。たとえば本来の処理とフォールバック処理が混在していると、本来の処理をテストしづらくなる。
  - VS Code APIを使用するコードは可能な限り分離する。
- ビジネスロジックは `services/` に実装し、VS Code APIへの直接依存を避ける。依存が必要な場合はインターフェース経由で注入する。
- コマンドハンドラーは `commands/` に実装し、ビジネスロジックを呼び出す。
- CompletionProviderなどのVS Code固有の機能は `providers/` に実装する。
- ユーティリティ関数は `utils/` に実装する。
- 型定義は `models/` にまとめる。
- 定数は `constants/` にまとめる。
- エントリーポイントは `extension.ts` に集約し、拡張機能の初期化を行う。
- コーディング規則 [eslint.config.mjs](eslint.config.mjs) を必ず確認すること。

## テスト

- vscodeを必要としないまたはモックでよい関数単位のテストは ユニットテスト `src/test/unit/` に配置する。このフォルダではvscodeは起動しない。
- vscodeを必要とする結合的なテストは統合テスト `src/test/integration/` に配置する。
  - テストファイルごとに `.vscode-test.mjs` の `defineConfig` に起動設定を追加する必要あり。

### 依存性注入パターン

サービスクラスでVS Code APIを使用する場合、テスタビリティを確保するため以下のパターンを採用する。

#### 1. インターフェース定義

`src/models/interfaces.ts` に必要な部分のみインターフェースを定義：

```typescript
export interface IConfiguration {
  get<T>(section: string, defaultValue?: T): T;
}

export interface IWorkspace {
  getConfiguration(section?: string): IConfiguration;
}

...
```

使用する機能ごとに個別のインターフェースを定義することで、依存関係を最小限に保つ。

#### 2. コンストラクタインジェクション

サービスクラスではvscodeのプロパティを表すインターフェースまたは実物を受け取る。
単体テストでは本物のvscodeを使えないので、必要な処理を持つモックとして `IWorkspace` を注入する。
`IWorkspace` に定義されていなければ、適宜 `workspace` に実在するプロパティを追加すること。

```typescript
import * as vscode from 'vscode';
import { IWorkspace } from '../models/interfaces';
export class ConfigService {
  constructor(private workspace: IWorkspace | typeof vscode.workspace) {}
  
  getConfig<T>(key: string, defaultValue: T): T {
    return this.workspace.getConfiguration('myExtension').get(key, defaultValue);
  }
}
```

#### 3. 実運用、統合テストでの注入

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const configService = new ConfigService(vscode.workspace); // 実際のVS Code APIを注入
}
```

#### 4. テストでの注入

```typescript
import { IWorkspace } from '../../models/interfaces';
// モック実装
const mockWorkspace: IWorkspace = {
  getConfiguration: () => ({
    get: (key, defaultValue) => defaultValue
  })
};
// 注入
const service = new ConfigService(mockWorkspace);
```

共通のモックは `test/unit/mocks/vscode.ts` にまとめておくと再利用しやすい。

### 静的ファイル（統合テスト）

テスト時に開く静的ファイルは `src/test/fixtures/workspaces/it-テスト名` に **必ず** 配置する（インメモリ禁止、OS一時フォルダ禁止）。
例： `extension.test.ts` の場合は `src/test/fixtures/workspaces/it-extension/` 。

配置したフォルダは `.vscode-test.mjs` により、自動的にワークスペースとして読み込まれる（`.tmp\yyyy-MM-dd\it-テスト名-hh-mm-ss` に配置されるが、統合テスト時のカレントディレクトリはテストランナーにより変更されているため相対パスでアクセスしないこと）。

```
src/test/
├── fixtures/              # テスト用の静的ファイル
│   └── workspaces/        # ワークスペース単位で分ける
│       ├── basic/         # 基本的なテストケース(再利用しやすい、識別しやすい任意の名前)
│       │   ├── file1.ts
│       │   └── file2.ts
│       └── complex/       # 複雑なテストケース(再利用しやすい、識別しやすい任意の名前)
│           └── nested/
│               └── deep.ts
├── unit/
└── integration/
```

静的ファイルはテスト間で共有しても良いし、独立させても良い。

### 静的ファイル（ユニットテスト）

ユニットテスト中にファイル書き込みを行う場合は、 `src\test\unit\unitTestUtil.ts` の `createTempDir(テスト識別子)` を使用して一時ディレクトリを作成し、その中で操作する。
返り値に `dispose()` メソッドがあるので、テスト終了後に呼び出してクリーンアップすること。
（デバッグ目的で一時的にクリーンアップをスキップしてもよい）