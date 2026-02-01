/**
 * KinDevST Content Script
 * セッション認証（Cookie）を使用したREST API実行用
 * 
 * 【重要】このファイルの関数は utils/rest-api-utils.js と同期が必要です。
 * Chrome拡張のContent ScriptはES6モジュールを直接importできないため、
 * 以下の関数を本ファイル内にインライン実装しています：
 * - buildRequestUrl()
 * - buildRequestOptions()
 * - executeRestApiRequest()
 * - buildErrorMessage()
 * 
 * rest-api-utils.js を変更した場合は、このファイルも同様に更新してください。
 */

'use strict';

// ストレージキー（constants.jsと同期）
const STORAGE_KEY_SHOW_EXECUTION_LOG = 'showExecutionLog';

// ===== ログ出力ヘルパー =====

/**
 * 実行ログ設定を取得
 * @returns {Promise<boolean>}
 */
async function getExecutionLogEnabled() {
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
  if (request.type === 'PING') {
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'EXECUTE_REST_API') {
    // 非同期でログ出力
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
  
  // URLを構築（DELETEの場合はCSRFトークンをクエリパラメータに追加）
  const url = buildRequestUrl(baseUrl, endpoint, method, params, requestToken);
  
  // リクエストオプションを構築（セッション認証用、POST/PUTの場合はCSRFトークンをボディに追加）
  const options = buildRequestOptions(method, params, requestToken);
  
  await logExecution('リクエスト送信:', method, url);
  
  // リクエスト実行
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

// ===== 共通ユーティリティ関数（utils/rest-api-utils.js と同期必要） =====

/**
 * リクエストURLを構築
 * @param {string} baseUrl - ベースURL
 * @param {string} endpoint - エンドポイント
 * @param {string} method - HTTPメソッド
 * @param {Object} params - パラメータ
 * @param {string|null} requestToken - CSRFトークン（セッション認証用）
 */
function buildRequestUrl(baseUrl, endpoint, method, params, requestToken = null) {
  let url = `${baseUrl}${endpoint}`;
  
  // GET/DELETEの場合はクエリパラメータとして追加
  if ((method === 'GET' || method === 'DELETE') && params) {
    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
      const queryParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      
      // DELETEの場合はCSRFトークンをクエリパラメーターに追加
      if (method === 'DELETE' && requestToken) {
        queryParams.append('__REQUEST_TOKEN__', requestToken);
      }
      
      const queryStr = queryParams.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }
    } else if (method === 'DELETE' && requestToken) {
      // paramsがない場合でもDELETEならCSRFトークンを追加
      url += `?__REQUEST_TOKEN__=${encodeURIComponent(requestToken)}`;
    }
  } else if (method === 'DELETE' && requestToken && !params) {
    // paramsがない場合でもDELETEならCSRFトークンを追加
    url += `?__REQUEST_TOKEN__=${encodeURIComponent(requestToken)}`;
  }
  
  return url;
}

/**
 * リクエストオプションを構築（セッション認証用）
 * @param {string} method - HTTPメソッド
 * @param {Object} params - パラメータ
 * @param {string|null} requestToken - CSRFトークン（セッション認証用）
 */
function buildRequestOptions(method, params, requestToken = null) {
  const options = {
    method: method,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'include' // Cookieを送信
  };
  
  // POST/PUTの場合はボディに追加（CSRFトークンも含める）
  if (params && (method === 'POST' || method === 'PUT')) {
    options.headers['Content-Type'] = 'application/json';
    const bodyParams = { ...params };
    if (requestToken) {
      bodyParams.__REQUEST_TOKEN__ = requestToken;  // リクエストボディに追加
    }
    options.body = JSON.stringify(bodyParams);
  } else if ((method === 'POST' || method === 'PUT') && requestToken) {
    // paramsがなくてもCSRFトークンはボディに追加
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ __REQUEST_TOKEN__: requestToken });
  }
  
  return options;
}

/**
 * REST APIリクエストを実行
 */
async function executeRestApiRequest(url, options) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  
  // レスポンスヘッダーを取得
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  
  if (!response.ok) {
    const errorMessage = buildErrorMessage(response, responseText);
    const error = new Error(errorMessage);
    // エラー時でもリクエストヘッダー、ステータスコード、レスポンスヘッダーを含める
    error.requestHeaders = options.headers;
    error.statusCode = response.status;
    error.statusText = response.statusText;
    error.responseHeaders = responseHeaders;
    throw error;
  }
  
  // レスポンスのパース
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }
  
  return {
    data: responseData,
    requestHeaders: options.headers,
    statusCode: response.status,
    statusText: response.statusText,
    responseHeaders: responseHeaders
  };
}

/**
 * エラーメッセージを構築
 */
function buildErrorMessage(response, responseText) {
  let errorMessage = `HTTP ${response.status} ${response.statusText}`;
  try {
    const errorData = JSON.parse(responseText);
    if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.errors) {
      errorMessage = JSON.stringify(errorData.errors);
    }
  } catch {
    if (responseText) {
      errorMessage += `: ${responseText}`;
    }
  }
  return errorMessage;
}
