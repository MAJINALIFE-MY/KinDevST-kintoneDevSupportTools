/**
 * KinDevST Content Script（ソース）
 * セッション認証（Cookie）を使用したREST API実行用
 *
 * このファイルは esbuild で `dist/content-script.js` へバンドルされる。
 * MV3 の content script は ES Module を直接 import できないため、共有ユーティリティ
 * （./utils/rest-api-utils.js・./utils/domain-validator.js）を import し、ビルドで単一
 * ファイルに固める。編集はこの src/ 側で行い、`npm run build` で dist/ を再生成すること。
 */

'use strict';

import { buildRequestUrl, buildRequestOptions, executeRestApiRequest } from './utils/rest-api-utils.js';
import { isKintoneUrl } from './utils/domain-validator.js';

// ストレージキー（constants.jsと同期）
const STORAGE_KEY_SHOW_EXECUTION_LOG = 'showExecutionLog';

// ===== ログ出力ヘルパー =====

/**
 * 実行ログ設定を取得
 * @returns {Promise<boolean>}
 */
function getExecutionLogEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_SHOW_EXECUTION_LOG], (items) => {
      resolve(items[STORAGE_KEY_SHOW_EXECUTION_LOG] !== undefined ? items[STORAGE_KEY_SHOW_EXECUTION_LOG] : false);
    });
  });
}

/**
 * 実行ログを出力（設定が有効な場合のみ）
 * @param  {...any} args - ログ引数
 */
async function logExecution(...args) {
  const enabled = await getExecutionLogEnabled();
  if (enabled) {
    console.log('[KinDevST Content Script]', ...args);
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 送信元検証: 本拡張自身から送られたメッセージのみ受理する
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (request.type === 'PING') {
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'EXECUTE_REST_API') {
    logExecution('メッセージ受信:', request.method, request.endpoint);

    handleRESTAPIExecution(request)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスのため
  }
});

/**
 * REST API実行処理（Content Script経由）
 */
async function handleRESTAPIExecution(request) {
  const { method, endpoint, params, domain, requestToken } = request;

  const baseUrl = `https://${domain}`;

  // 最終防衛線: セッションCookie付きリクエストを送る直前にドメインを厳密検証する
  if (!isKintoneUrl(baseUrl)) {
    throw new Error('実行先が有効なkintoneドメイン（*.cybozu.com）ではないため、リクエストを中止しました。');
  }

  // URLを構築（DELETEの場合はCSRFトークンをクエリパラメータに追加）
  const url = buildRequestUrl(baseUrl, endpoint, method, params, requestToken);

  // リクエストオプションを構築（セッション認証用、POST/PUTの場合はCSRFトークンをボディに追加）
  const options = buildRequestOptions(method, params, { includeCredentials: true, requestToken });

  await logExecution('リクエスト送信:', method, url);

  try {
    const result = await executeRestApiRequest(url, options);
    await logExecution('リクエスト成功:', result.statusCode, result.statusText);
    return result;
  } catch (error) {
    console.error('[KinDevST Content Script] リクエスト失敗:', error.message);
    if (error.statusCode) {
      console.error('[KinDevST Content Script] ステータスコード:', error.statusCode);
    }
    if (error.requestHeaders) {
      await logExecution('リクエストヘッダー:', error.requestHeaders);
    }
    throw error;
  }
}
