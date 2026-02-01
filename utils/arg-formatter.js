/**
 * KinDevST 引数フォーマットモジュール
 * API引数の表示と変換を統一的に管理
 */

'use strict';

/**
 * 引数を表示用の文字列に変換
 * @param {Array<any>} args - 引数の配列
 * @returns {string} 表示用文字列
 */
export function formatArgsForDisplay(args) {
  if (!args || args.length === 0) {
    return '()';
  }
  
  const formatted = args.map(arg => {
    if (arg === undefined || arg === null) {
      return 'undefined';
    }
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(', ');
  
  return `(${formatted})`;
}

/**
 * 履歴からコピー用のテキストを生成（REST API用）
 * @param {string} argsJson - JSON文字列化された引数
 * @returns {string} コピー用テキスト
 */
export function formatArgsForRestCopy(argsJson) {
  if (!argsJson) return '';
  
  try {
    const args = JSON.parse(argsJson);
    // REST APIの場合：Bodyフィールドに直接ペーストできる形式（オブジェクトのJSON）
    if (Array.isArray(args) && args.length > 0 && typeof args[0] === 'object') {
      return JSON.stringify(args[0], null, 2);
    } else if (typeof args === 'object' && args !== null) {
      return JSON.stringify(args, null, 2);
    }
  } catch (e) {
    return argsJson;
  }
  return '';
}

/**
 * 履歴からコピー用のテキストを生成（JS API用）
 * @param {string} argsJson - JSON文字列化された引数
 * @returns {string} コピー用テキスト
 */
export function formatArgsForJsCopy(argsJson) {
  if (!argsJson) return '';
  
  try {
    const args = JSON.parse(argsJson);
    // JS APIの場合：引数フィールドに直接ペーストできる形式
    if (Array.isArray(args) && args.length > 0) {
      // 最初の引数がオブジェクトの場合はそのまま、そうでない場合は配列全体をコピー
      if (typeof args[0] === 'object' && args[0] !== null) {
        return JSON.stringify(args[0], null, 2);
      } else {
        return JSON.stringify(args, null, 2);
      }
    } else if (typeof args === 'object' && args !== null) {
      return JSON.stringify(args, null, 2);
    }
  } catch (e) {
    return argsJson;
  }
  return '';
}

/**
 * 入力値をAPI引数に変換
 * @param {string} value - 入力値
 * @returns {any} 変換後の値（空の場合はundefined）
 */
export function parseArgValue(value) {
  if (!value) {
    return undefined;
  }
  
  // 空白文字（改行、スペース、タブなど）だけの入力も空として扱う
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  
  // 明示的な"undefined"文字列をundefinedに変換
  if (trimmed.toLowerCase() === 'undefined') {
    return undefined;
  }
  
  // JSONパースを試みる
  try {
    return JSON.parse(value);
  } catch (e) {
    // パースできない場合は文字列として扱う
    return value;
  }
}

/**
 * REST APIの引数を表示用の文字列に変換（HTTPメソッドに応じて適切な形式で表示）
 * @param {string} method - HTTPメソッド（GET, POST, PUT, DELETE）
 * @param {any} params - パラメータオブジェクト
 * @returns {string} 表示用文字列
 */
export function formatRestArgsForDisplay(method, params) {
  if (!params || (typeof params === 'object' && Object.keys(params).length === 0)) {
    return '';
  }
  
  // GET/DELETEの場合はクエリパラメータ形式で表示
  if (method === 'GET' || method === 'DELETE') {
    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
      const queryParams = [];
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          queryParams.push(`${key}=${encodeURIComponent(value)}`);
        }
      });
      return queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    }
  }
  
  // POST/PUTの場合はJSON形式で表示
  try {
    return JSON.stringify(params, null, 2);
  } catch (e) {
    return String(params);
  }
}
