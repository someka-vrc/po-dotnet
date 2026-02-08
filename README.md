# po-support

A Visual Studio Code extension for supporting PO files.

現在開発中のため、実装メモとしてREADMEを使用しています。完成後に内容を整理します。

## Features

(実装済み機能をここに記載)

## TODO, Loadmap

(今後の実装予定やロードマップをここに記載)

### 設定サービスの開発

- Settings(vscode上の設定)と、任意の場所に配置される設定ファイル `po-support.json` の両方をサポートする。
- 
- ワークスペース内の`po-support.json` と Settings の変更・追加・削除を自動検出し、マージして保持する。
- 設定内容の変更時にイベントを発火する（将来開発するサービスで利用予定）。

#### 設定内容

Settings: 

```json
{
  "po-support.targets": [
    {
      "type": "po",
      "languages": ["csharp"],
      "sourceDirs": ["./foo"],
      "poDirs": ["./fooL10N"],
      "funcNames": ["G", "L"]
    },
    {
      "type": "po",
      "languages": ["csharp"],
      "sourceDirs": ["./bar"],
      "poDirs": ["./barL10N"],
      "funcNames": ["G", "L"]
    }
  ], 
  "po-support.wasmCdnBaseURL": "https://unpkg.com/tree-sitter-wasms@latest/out/"
}
```

ターゲット要素単位で管理する。つまり上記例では、 `./foo/*.cs` は `./fooL10N/*.po` と紐付くが、  `./barL10N/*.po` とは紐つかない。fooとbarがワークスペース内の異なるプロジェクトであると考えると、混ざらないのが自然である。

`po-support.json`:

```json
{
  "targets": [
    {
      "type": "po",
      "languages": ["csharp", "javascript"],
      "sourceDirs": ["./src"],
      "poDirs": ["./locales", "./i18n"],
      "funcNames": ["G", "L"]
    }
  ]
}
```

- `type`: ターゲットの種類を指定します。現時点では `po` のみサポートしています。
- `languages`: プログラミング言語を指定します。
  - 指定可能な値: `csharp`, `javascript`, `typescript`, `python`
  - デフォルト値: `csharp`
- `sourceDirs`: .cs ファイルのフォルダを指定します。サブフォルダも対象となります。設定ファイルからの相対パスで指定してください。通常は `.` で十分です。一部のフォルダでのみ機能させたい場合は詳細に指定してください。
  - 例: `[".", "src", "lib/foo"]`
  - デフォルト値: `["."]`
- `poDirs`: .po ファイルのフォルダを指定します。サブフォルダも対象となります。設定ファイルからの相対パスで指定してください。
  - 例: `["./locales", "./i18n"]`
  - デフォルト値: `["./l10n"]`
- `funcNames`: ローカライズ関数の名前を指定します。
- `wasmCdnBaseURL`: Settings のみ。ソースコード解析で使用する tree-sitter の言語別 wasm バイナリの取得元を制御します。
  - デフォルト値: `https://unpkg.com/tree-sitter-wasms@latest/out/`



---

(以降はテンプレートのため変更せずに保持すること)

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
