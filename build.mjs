/**
 * KinDevST ビルドスクリプト
 *
 * ソース（src/）から読み込み可能な拡張機能（dist/）を生成する。
 *   1. dist/ をクリーンし、src/ 配下の静的/実行ファイルをすべて dist/ へコピー
 *   2. content script だけは ES Module を直接 import できないため、
 *      src/content-script.js（共有ユーティリティを import）を esbuild で
 *      dist/content-script.js（単一ファイル・IIFE）へバンドル
 *
 * background.js / sidepanel.js とその配下モジュールはブラウザがネイティブに
 * ES Module として解決するため、コピーするだけでよい（バンドル不要）。
 *
 * 使い方:
 *   npm run build     一度だけビルド
 *   npm run watch     src/ の変更を監視して再ビルド
 *
 * 読み込み: chrome://extensions で dist/ を「パッケージ化されていない拡張機能」として読み込む。
 */

import { build } from 'esbuild';
import { rmSync, mkdirSync, cpSync } from 'fs';

const SRC = 'src';
const OUT = 'dist';

// content script のソースはバンドルして出力するため、そのままのコピー対象からは除外する
const CONTENT_SCRIPT_SRC = `${SRC}/content-script.js`;

/** @type {import('esbuild').BuildOptions} */
const bundleOptions = {
  entryPoints: [CONTENT_SCRIPT_SRC],
  outfile: `${OUT}/content-script.js`,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  legalComments: 'none',
  banner: {
    js: '/* 自動生成ファイル: src/content-script.js を編集し `npm run build` で再生成すること。直接編集しないでください。 */'
  }
};

async function runBuild() {
  // 1. dist をクリーン
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // 2. src → dist へコピー（content script のソースだけは除外＝バンドル版を出力するため）
  cpSync(SRC, OUT, {
    recursive: true,
    filter: (src) => src.replace(/\\/g, '/') !== CONTENT_SCRIPT_SRC
  });

  // 3. content script をバンドル
  await build(bundleOptions);

  console.log(`[KinDevST build] ${OUT}/ を生成しました`);
}

const watch = process.argv.includes('--watch');

await runBuild();

if (watch) {
  const { watch: fsWatch } = await import('fs');
  let timer = null;
  fsWatch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      runBuild().catch(err => console.error('[KinDevST build] エラー:', err));
    }, 100);
  });
  console.log(`[KinDevST build] ${SRC}/ を監視中 ...`);
}
