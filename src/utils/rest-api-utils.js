/**
 * KinDevST REST API共通ユーティリティ
 * background.jsとcontent-script.jsで共通のREST API処理を提供
 */

'use strict';

/**
 * リクエストURLを構築
 *
 * セッション認証（Cookie）では POST/PUT の CSRF トークンはボディに、
 * DELETE はクエリパラメータ（__REQUEST_TOKEN__）に付与する必要がある。
 * requestToken を渡すと DELETE 時にクエリへトークンを追加する。
 *
 * @param {string} baseUrl - ベースURL（例: "https://example.cybozu.com"）
 * @param {string} endpoint - エンドポイント（例: "/k/v1/record.json"）
 * @param {string} method - HTTPメソッド
 * @param {Object|null} params - リクエストパラメータ
 * @param {string|null} requestToken - CSRFトークン（セッション認証の DELETE 用）
 * @returns {string} 構築されたURL
 */
export function buildRequestUrl(baseUrl, endpoint, method, params, requestToken = null) {
  let url = `${baseUrl}${endpoint}`;

  // GET/DELETEの場合はクエリパラメータとして追加
  if ((method === 'GET' || method === 'DELETE') && params &&
      typeof params === 'object' && !Array.isArray(params)) {
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

  return url;
}

/**
 * リクエストオプションを構築
 * @param {string} method - HTTPメソッド
 * @param {Object|null} params - リクエストパラメータ
 * @param {Object} [opts] - オプション
 * @param {Object} [opts.additionalHeaders] - 追加のヘッダー（認証ヘッダーなど）
 * @param {boolean} [opts.includeCredentials] - credentials: 'include'（セッション認証）を設定するか
 * @param {string|null} [opts.requestToken] - CSRFトークン（セッション認証の POST/PUT 用、ボディに付与）
 * @returns {Object} fetchオプション
 */
export function buildRequestOptions(method, params, opts = {}) {
  const { additionalHeaders = {}, includeCredentials = false, requestToken = null } = opts;

  const options = {
    method: method,
    headers: { ...additionalHeaders }
  };

  if (includeCredentials) {
    options.credentials = 'include';
    options.headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  // POST/PUTの場合はボディに追加（セッション認証では CSRF トークンも含める）
  const isWrite = method === 'POST' || method === 'PUT';
  if (isWrite && (params || requestToken)) {
    options.headers['Content-Type'] = 'application/json';
    const bodyParams = { ...(params || {}) };
    if (requestToken) {
      bodyParams.__REQUEST_TOKEN__ = requestToken;
    }
    options.body = JSON.stringify(bodyParams);
  }

  return options;
}

/**
 * レスポンスヘッダーをオブジェクトに変換
 * @param {Headers} headers - Responseのheaders
 * @returns {Object} ヘッダーオブジェクト
 */
export function extractResponseHeaders(headers) {
  const responseHeaders = {};
  headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  return responseHeaders;
}

/**
 * レスポンスをパース
 * @param {string} responseText - レスポンステキスト
 * @returns {any} パースされたデータ
 */
export function parseResponseText(responseText) {
  try {
    return JSON.parse(responseText);
  } catch {
    // JSONでない場合はテキストをそのまま返す
    return responseText;
  }
}

/**
 * エラーレスポンスを処理してエラーメッセージを生成
 * @param {Response} response - fetchレスポンス
 * @param {string} responseText - レスポンステキスト
 * @returns {string} エラーメッセージ
 */
export function buildErrorMessage(response, responseText) {
  let errorMessage = `HTTP ${response.status} ${response.statusText}`;
  try {
    const errorData = JSON.parse(responseText);
    if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.errors) {
      errorMessage = JSON.stringify(errorData.errors);
    }
  } catch {
    // JSONパースに失敗した場合はテキストをそのまま使用
    if (responseText) {
      errorMessage += `: ${responseText}`;
    }
  }
  return errorMessage;
}

/**
 * REST APIを実行して結果を返す共通処理
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @returns {Promise<Object>} 実行結果（data, requestHeaders, statusCode, statusText, responseHeaders）
 */
export async function executeRestApiRequest(url, options) {
  const response = await fetch(url, options);
  const responseText = await response.text();
  const responseHeaders = extractResponseHeaders(response.headers);
  
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
  
  const responseData = parseResponseText(responseText);
  
  return {
    data: responseData,
    requestHeaders: options.headers,
    statusCode: response.status,
    statusText: response.statusText,
    responseHeaders: responseHeaders
  };
}
