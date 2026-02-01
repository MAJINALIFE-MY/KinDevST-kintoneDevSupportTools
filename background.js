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
import { ERROR_MESSAGES, STORAGE_KEYS, AUTH_TYPES } from './utils/constants.js';

// ===== オートロック機能 =====

// アイドル検知の間隔（15分 = 900秒）
const IDLE_THRESHOLD_SECONDS = 900;

// アイドル検知の初期化
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

// アイドル状態変化のリスナー
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'idle' || newState === 'locked') {
    // 認証情報を保存する方式（パスワード、APIトークン、OAuth）の場合のみオートロックを実行
    // セッション認証（Cookie使用）の場合は認証情報を保存していないため、オートロックを実行しない
    const authConfig = await getAuthConfigFromSession();
    
    if (authConfig && authConfig.authType && authConfig.authType !== AUTH_TYPES.SESSION) {
      // 認証情報を削除
      await clearAuthCredentials();
      console.log(`[KinDevST Background] Auto-Lock: State ${newState} - Session cleared.`);
      
      // サイドパネルにログアウト通知を送信
      try {
        chrome.runtime.sendMessage({ type: 'EVENT_LOGOUT' }).catch(() => {
          // サイドパネルが開いていない場合はエラーになるが、無視する
        });
      } catch (e) {
        // エラーは無視
      }
    }
  }
});

/**
 * セッションストレージから認証設定を取得（オートロック判定用）
 * @returns {Promise<Object|null>} 認証設定オブジェクト
 */
async function getAuthConfigFromSession() {
  return new Promise((resolve) => {
    chrome.storage.session.get([STORAGE_KEYS.AUTH_TYPE], (items) => {
      if (items[STORAGE_KEYS.AUTH_TYPE]) {
        resolve({ authType: items[STORAGE_KEYS.AUTH_TYPE] });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * 認証情報をクリア（オートロック用）
 * @returns {Promise<void>}
 */
async function clearAuthCredentials() {
  return new Promise((resolve) => {
    chrome.storage.session.remove([
      STORAGE_KEYS.AUTH_TYPE,
      STORAGE_KEYS.AUTH_USER,
      STORAGE_KEYS.AUTH_PASS,
      STORAGE_KEYS.AUTH_API_TOKEN,
      STORAGE_KEYS.OAUTH_CLIENT_ID,
      STORAGE_KEYS.OAUTH_CLIENT_SECRET
    ], resolve);
  });
}

// ===== ログ出力ヘルパー =====

/**
 * 実行ログ設定を取得
 * @returns {Promise<boolean>}
 */
async function getExecutionLogEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SHOW_EXECUTION_LOG], (items) => {
      resolve(items[STORAGE_KEYS.SHOW_EXECUTION_LOG] !== undefined ? items[STORAGE_KEYS.SHOW_EXECUTION_LOG] : false);
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
 * Service WorkerからREST APIを実行（パスワード/APIトークン/OAuth認証用）
 */
async function executeFromServiceWorker(method, endpoint, params, domain, authConfig) {
  const baseUrl = `https://${domain}`;
  
  // 認証ヘッダーを構築
  const authHeaders = buildAuthHeaders(authConfig);
  
  // URLを構築
  const url = buildRequestUrl(baseUrl, endpoint, method, params);
  
  // リクエストオプションを構築
  const options = buildRequestOptions(method, params, authHeaders, false);
  
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
      
    case 'oauth':
      // OAuth認証（アクセストークンが必要）
      if (!authConfig.accessToken) {
        throw new Error(ERROR_MESSAGES.AUTH_OAUTH_TOKEN_REQUIRED);
      }
      headers['Authorization'] = `Bearer ${authConfig.accessToken}`;
      break;
      
    case 'session':
      // セッション認証はContent Script経由で実行されるため、ここには来ない
      throw new Error(ERROR_MESSAGES.AUTH_SESSION_VIA_CONTENT_SCRIPT);
      
    default:
      throw new Error(`${ERROR_MESSAGES.AUTH_UNKNOWN_TYPE}: ${authType}`);
  }
  
  return headers;
}
