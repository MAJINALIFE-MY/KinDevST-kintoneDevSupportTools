# KinDevST - kintone Developer Support Tool

kintone のセッション認証を利用し、REST API と JavaScript API を Chrome のサイドパネルから実行する**開発者向け** Chrome 拡張機能です。  
（別プロジェクト「KinST」はユーザー向けサポートツールとして将来運用する想定です。）

## 主な機能

- **REST API タブ**  
  表示名・API 選択、Body / Query 入力、実行、履歴表示、公式ドキュメントへのリンク。

- **JS API タブ**  
  表示名・API 選択、引数入力、実行、履歴表示、公式ドキュメントへのリンク。

- **Setting タブ**
  - **認証**: パスワード認証 / APIトークン / OAuth / セッション認証（Cookie）
  - **タブ設定**: 現在開いている kintone タブを記憶し、他サイトを開いたまま API を実行可能
  - **表示設定**: ログのコピー・再実行・削除ボタン、REST の Request / Response Headers・Status Code の表示 on/off
  - **履歴**: 実行結果の保存件数（1〜30 件）
  - **開発者向け**: 実行ログを DevTools Console に出力するオプション

## セキュリティ・プライバシー

- 認証キー等は **session ストレージ** を利用（ローカルストレージには永続しません）。
- **15分無操作** または **画面ロック** で認証情報を自動削除します。
- kintone コーディングガイドラインを参考に、**innerHTML を使用しない** 方針で実装しています（XSS 対策）。

## 必要な環境

- Google Chrome（Manifest V3 対応）
- kintone（`*.cybozu.com`）へのアクセス

## インストール方法

1. このリポジトリをクローンまたは ZIP でダウンロードする。
2. Chrome で `chrome://extensions/` を開く。
3. 「開発者モード」を有効にする。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このリポジトリのルートフォルダ（`KinST-kintoneSupportTools`）を選択する。

## 使い方

1. kintone にログインしたタブを開く。
2. 拡張機能のアイコンをクリックしてサイドパネルを開く。
3. **Setting** タブで認証方式を設定するか、「現在開いているタブを記憶」で kintone タブを登録する。
4. **REST API** または **JS API** タブで API を選択し、パラメータを入力して「実行」する。

## 利用ライブラリ

- jQuery 4.0.0（lib/ に同梱）
- Select2（lib/ に同梱）

## 作者・リンク

- **ポートフォリオサイト**: [Yugo Morita Dev.](https://moritayugo.com/)（フロント・バックエンドから業務改善まで｜ポートフォリオ＆技術ログ）

## 免責事項

本拡張機能は kintone / サイボウズの公式製品ではありません。個人・コミュニティによるものです。利用は自己責任でお願いします。

## ライセンス

MIT License。詳細は [LICENSE](LICENSE) を参照してください。
