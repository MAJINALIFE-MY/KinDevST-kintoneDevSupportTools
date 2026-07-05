/**
 * KinDevST Background Service Worker
 * REST API実行のルーティングと認証処理を管理
 */

'use strict';

import {
  buildRequestUrl,
  buildRequestOptions,
  executeRestApiRequest
} from './utils/rest-api-utils.js';
import { ERROR_MESSAGES, STORAGE_KEYS } from './utils/constants.js';
import { assertKintoneUrl } from './utils/domain-validator.js';

// ===== ログ出力ヘルパー =====

/**
 * 実行ログ設定を取得
 * @returns {Promise<boolean>}
 */
async function getExecutionLogEnabled() {
  const items = await chrome.storage.local.get([STORAGE_KEYS.SHOW_EXECUTION_LOG]);
  return items[STORAGE_KEYS.SHOW_EXECUTION_LOG] ?? false;
}

/**
 * 実行ログを出力（設定が有効な場合のみ）
 * @param  {...any} args - ログ引数
 */
async function logExecution(...args) {
  const enabled = await getExecutionLogEnabled();
  if (enabled) {
    console.log('[KinDevST Background]', ...args);
  }
}

// サイドパネルを開くアクション
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// REST API実行のメッセージハンドラー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REST_API_EXECUTE') {
    // 送信元検証: 本拡張自身から送られたメッセージのみ受理する
    // （外部拡張・Webページからの externally_connectable 経由の呼び出しを排除）
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ success: false, error: ERROR_MESSAGES.UNEXPECTED_RESPONSE });
      return false;
    }
    handleRESTAPIExecution(request)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスのため
  }
});

/**
 * REST API実行処理
 */
async function handleRESTAPIExecution(request) {
  const { method, endpoint, params, domain, authConfig, tabId } = request;
  
  // 認証方式の確認
  const authType = authConfig?.authType || 'session';
  
  // セッション認証の場合は、Content Script経由で実行（Cookieにアクセスするため）
  if (authType === 'session' && tabId) {
    return await executeViaContentScript(tabId, method, endpoint, params, domain);
  }
  
  // その他の認証方式はService Workerから実行
  return await executeFromServiceWorker(method, endpoint, params, domain, authConfig);
}

/**
 * Content Script経由でREST APIを実行（セッション認証用）
 */
async function executeViaContentScript(tabId, method, endpoint, params, domain) {
  // POST/PUT/DELETEの場合はCSRFトークンを取得
  let requestToken = null;
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    await logExecution('CSRFトークン取得開始...');
    try {
      requestToken = await getRequestTokenFromPage(tabId);
      await logExecution('CSRFトークン取得成功');
    } catch (error) {
      console.error('[KinDevST Background] CSRFトークン取得失敗:', error.message);
      throw new Error(`${ERROR_MESSAGES.CSRF_TOKEN_FETCH_FAILED}: ${error.message}`);
    }
    
    // トークンが空の場合はエラー
    if (!requestToken) {
      console.error('[KinDevST Background] CSRFトークンが空です');
      throw new Error(ERROR_MESSAGES.CSRF_TOKEN_EMPTY);
    }
  }
  
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_REST_API',
      method,
      endpoint,
      params,
      domain,
      requestToken  // CSRFトークンを渡す
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response && response.error) {
        reject(new Error(response.error));
        return;
      }
      
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(ERROR_MESSAGES.UNEXPECTED_RESPONSE));
      }
    });
  });
}

/**
 * ページからCSRFトークン（リクエストトークン）を取得
 * @param {number} tabId - タブID
 * @returns {Promise<string>} CSRFトークン
 */
async function getRequestTokenFromPage(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',  // ページコンテキストで実行（kintoneオブジェクトにアクセスするため）
    func: () => {
      // kintone.getRequestToken() を実行
      if (typeof kintone !== 'undefined' && typeof kintone.getRequestToken === 'function') {
        return kintone.getRequestToken();
      }
      throw new Error('kintone.getRequestToken() が利用できません');
    }
  });
  
  if (results && results[0] && results[0].result) {
    return results[0].result;
  }
  
  throw new Error('CSRFトークンの取得に失敗しました');
}

/**
 * Service WorkerからREST APIを実行（パスワード/APIトークン認証用）
 */
async function executeFromServiceWorker(method, endpoint, params, domain, authConfig) {
  const baseUrl = `https://${domain}`;

  // 最終防衛線: 認証ヘッダー付きリクエストを送る直前にドメインを厳密検証する。
  // 部分文字列一致をすり抜けた不正ドメインへ認証情報が漏れるのを防ぐ。
  assertKintoneUrl(baseUrl, ERROR_MESSAGES.INVALID_KINTONE_DOMAIN);

  // 認証ヘッダーを構築
  const authHeaders = buildAuthHeaders(authConfig);
  
  // URLを構築
  const url = buildRequestUrl(baseUrl, endpoint, method, params);

  // リクエストオプションを構築（認証ヘッダー付与、Cookie は使わない）
  const options = buildRequestOptions(method, params, { additionalHeaders: authHeaders });
  
  // リクエスト実行
  return await executeRestApiRequest(url, options);
}

/**
 * 認証ヘッダーを構築
 * @param {Object} authConfig - 認証設定
 * @returns {Object} 認証ヘッダー
 */
function buildAuthHeaders(authConfig) {
  const headers = {};
  
  if (!authConfig || !authConfig.authType) {
    return headers;
  }
  
  const authType = authConfig.authType;
  
  switch (authType) {
    case 'password':
      // パスワード認証（X-Cybozu-Authorizationヘッダーを使用）
      if (!authConfig.username || !authConfig.password) {
        throw new Error(ERROR_MESSAGES.AUTH_PASSWORD_REQUIRED);
      }
      const credentials = btoa(`${authConfig.username}:${authConfig.password}`);
      headers['X-Cybozu-Authorization'] = credentials;
      break;
      
    case 'token':
      // APIトークン認証
      if (!authConfig.apiToken) {
        throw new Error(ERROR_MESSAGES.AUTH_TOKEN_REQUIRED);
      }
      headers['X-Cybozu-API-Token'] = authConfig.apiToken;
      break;

    case 'session':
      // セッション認証はContent Script経由で実行されるため、ここには来ない
      throw new Error(ERROR_MESSAGES.AUTH_SESSION_VIA_CONTENT_SCRIPT);
      
    default:
      throw new Error(`${ERROR_MESSAGES.AUTH_UNKNOWN_TYPE}: ${authType}`);
  }
  
  return headers;
}
