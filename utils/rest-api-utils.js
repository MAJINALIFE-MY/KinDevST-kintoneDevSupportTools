/**
 * KinDevST REST API共通ユーティリティ
 * background.jsとcontent-script.jsで共通のREST API処理を提供
 */

'use strict';

/**
 * リクエストURLを構築
 * @param {string} baseUrl - ベースURL（例: "https://example.cybozu.com"）
 * @param {string} endpoint - エンドポイント（例: "/k/v1/record.json"）
 * @param {string} method - HTTPメソッド
 * @param {Object|null} params - リクエストパラメータ
 * @returns {string} 構築されたURL
 */
export function buildRequestUrl(baseUrl, endpoint, method, params) {
  let url = `${baseUrl}${endpoint}`;
  
  // GET/DELETEの場合はクエリパラメータとして追加
  if ((method === 'GET' || method === 'DELETE') && params) {
    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
      const queryString = new URLSearchParams();
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
      const queryStr = queryString.toString();
      if (queryStr) {
        url += `?${queryStr}`;
      }
    }
  }
  
  return url;
}

/**
 * リクエストオプションを構築
 * @param {string} method - HTTPメソッド
 * @param {Object|null} params - リクエストパラメータ
 * @param {Object} additionalHeaders - 追加のヘッダー（認証ヘッダーなど）
 * @param {boolean} includeCredentials - credentials: 'include' を設定するか
 * @returns {Object} fetchオプション
 */
export function buildRequestOptions(method, params, additionalHeaders = {}, includeCredentials = false) {
  const options = {
    method: method,
    headers: { ...additionalHeaders }
  };
  
  if (includeCredentials) {
    options.credentials = 'include';
    options.headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  
  // POST/PUTの場合はボディに追加
  if (params && (method === 'POST' || method === 'PUT')) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(params);
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
