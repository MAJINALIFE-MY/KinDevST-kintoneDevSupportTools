/**
 * KinDevST メッセージングユーティリティ
 * chrome.runtime.sendMessage のコールバックを Promise でラップし、
 * { success, data, error } 形式のレスポンス規約を一元的に解釈する。
 */

'use strict';

import { ERROR_MESSAGES } from './constants.js';

/**
 * Background Service Worker へメッセージを送信し、結果を Promise で返す
 * @param {Object} message - 送信するメッセージ
 * @returns {Promise<any>} response.data（成功時）
 * @throws {Error} lastError / response.error / 予期しない形式の場合
 */
export function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
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
