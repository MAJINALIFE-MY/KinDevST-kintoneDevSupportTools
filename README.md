# KinDevST - kintone Developer Support Tool

kintone のセッション認証を利用し、REST API と JavaScript API を Chrome のサイドパネルから実行する**開発者向け** Chrome 拡張機能です。  
（別プロジェクト「KinST」はユーザー向けサポートツールとして将来運用する想定です。）

## 主な機能

- **REST API タブ**  
  表示名・API 選択、Body / Query 入力、実行、履歴表示、公式ドキュメントへのリンク。

- **JS API タブ**  
  表示名・API 選択、引数入力、実行、履歴表示、公式ドキュメントへのリンク。

- **Setting タブ**
  - **認証**: パスワード認証 / APIトークン / セッション認証（Cookie）
  - **タブ設定**: 現在開いている kintone タブを記憶し、他サイトを開いたまま API を実行可能
  - **表示設定**: ログのコピー・再実行・削除ボタン、REST の Request / Response Headers・Status Code の表示 on/off
  - **履歴**: 実行結果の保存件数（1〜30 件）
  - **開発者向け**: 実行ログを DevTools Console に出力するオプション

## セキュリティ・プライバシー

- **認証情報（ログイン名・パスワード・APIトークン等）は一切永続化しません。** 実行のたびに Setting タブの入力欄から読み取り、メモリ上でのみ使用します（ストレージにも保存しないため、暗号化・自動削除の仕組みも不要になりました）。
- **実行先ドメインを厳密に検証します。** `*.cybozu.com` にラベル境界で一致する場合のみリクエストを送信し、`x.cybozu.com.evil.example` のような紛らわしいドメインへ認証情報が漏れないよう多層で防御しています（サイドパネル・Service Worker・Content Script の各層で検証）。
- kintone コーディングガイドラインを参考に、**innerHTML を使用しない** 方針で実装しています（XSS 対策）。

## 必要な環境

- Google Chrome（Manifest V3 対応）
- kintone（`*.cybozu.com`）へのアクセス

## インストール方法

拡張機能本体は `src/`（ソース）から `dist/`（読み込む対象）へビルドして生成します。

1. このリポジトリをクローンまたは ZIP でダウンロードする。
2. ルートで `npm install` → `npm run build` を実行し、`dist/` を生成する。
3. Chrome で `chrome://extensions/` を開く。
4. 「開発者モード」を有効にする。
5. 「パッケージ化されていない拡張機能を読み込む」をクリックし、生成された **`dist/` フォルダ**を選択する。

## 使い方

1. kintone にログインしたタブを開く。
2. 拡張機能のアイコンをクリックしてサイドパネルを開く。
3. **Setting** タブで認証方式を設定するか、「現在開いているタブを記憶」で kintone タブを登録する。
4. **REST API** または **JS API** タブで API を選択し、パラメータを入力して「実行」する。

## ビルド

ソースは `src/` に置き、`dist/` を生成して読み込みます（`dist/` は Git 管理外＝生成物）。

```bash
npm install      # 初回のみ（esbuild を取得）
npm run build    # src/ → dist/ を生成
npm run watch    # src/ の変更を監視して自動再ビルド
```

`npm run build` は次を行います。

- `src/` 配下の実行ファイル（`manifest.json`・`background.js`・`sidepanel.*`・`utils/`・`api/`・`ui/`・各 `*-api/`・`lib/`・`icons/` など）を `dist/` へコピー。
- **Content Script のみ**、MV3 では ES Module を直接 import できないため、`src/content-script.js`（共有ユーティリティを import）を esbuild で `dist/content-script.js`（単一ファイル）へバンドル。

`background.js` と `sidepanel.js`（およびその配下モジュール）はブラウザがネイティブに ES Module として解決するため、コピーのみでバンドルは不要です。

### フォルダ構成

```
リポジトリルート/
  package.json  build.mjs  node_modules/   ← ビルド管理
  src/                                       ← ソース（Git 管理）
    manifest.json  background.js  sidepanel.*  content-script.js(ソース)
    utils/  api/  ui/  js-api/  rest-api/  user-api/  lib/  icons/
  dist/                                       ← 生成物（chrome で読み込む対象・Git 管理外）
```

## 利用ライブラリ

- jQuery 4.0.0（lib/ に同梱）
- Select2（lib/ に同梱）

## 作者・リンク

- **ポートフォリオサイト**: [Yugo Morita Dev.](https://moritayugo.com/)（フロント・バックエンドから業務改善まで｜ポートフォリオ＆技術ログ）

## 免責事項

本拡張機能は kintone / サイボウズの公式製品ではありません。個人・コミュニティによるものです。利用は自己責任でお願いします。

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
