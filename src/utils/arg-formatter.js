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
