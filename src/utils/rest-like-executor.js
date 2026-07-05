/**
 * KinDevST REST 系 API 実行クラス（REST API / User API 共通）
 * Background Service Worker 経由で REST 形式の API を実行する。
 * セッション認証の場合は Content Script を注入し、CSRF トークン取得経由で実行する。
 */

'use strict';

import { TIMING, ERROR_MESSAGES, AUTH_TYPES } from './constants.js';
import { ConfigManager } from './config-manager.js';
import { sendRuntimeMessage } from './messaging.js';

/**
 * REST 形式 API の実行クラス。REST API・User API はいずれもこのクラスを使用する。
 */
export class RestLikeExecutor {
  constructor(definitionManager) {
    this.definitionManager = definitionManager;
  }

  /**
   * REST 形式 API を実行する（Background Service Worker 経由）
   * @param {string} apiName - API名（例: "GET /k/v1/record.json"）
   * @param {Object} params - リクエストパラメータ（クエリパラメータやボディ）
   * @param {string} domain - kintoneドメイン（例: "example.cybozu.com"）
   * @param {Object} authConfig - 認証設定
   * @returns {Promise<Object>} 実行結果
   */
  async execute(apiName, params, domain, authConfig) {
    const { method, endpoint } = this._resolveMethodEndpoint(apiName);
    const authType = authConfig?.authType || AUTH_TYPES.SESSION;

    // セッション認証の場合は Content Script が必要（CSRFトークン取得のため）
    let tabId;
    if (authType === AUTH_TYPES.SESSION) {
      tabId = await ConfigManager.getKintoneTabIdForExecution();
      await this._ensureContentScript(tabId);
    }

    return sendRuntimeMessage({
      type: 'REST_API_EXECUTE',
      apiName,
      method,
      endpoint,
      params,
      domain,
      authConfig,
      ...(tabId ? { tabId } : {})
    });
  }

  /**
   * API定義または apiName 文字列から method / endpoint を解決
   * @private
   */
  _resolveMethodEndpoint(apiName) {
    const definition = this.definitionManager.getDefinition(apiName);
    if (definition) {
      return { method: definition.method, endpoint: definition.endpoint };
    }
    // 定義が見つからない場合は apiName から解析（例: "GET /k/v1/record.json"）
    const parts = apiName.split(' ');
    if (parts.length >= 2) {
      return { method: parts[0], endpoint: parts.slice(1).join(' ') };
    }
    throw new Error(`${ERROR_MESSAGES.API_DEFINITION_NOT_FOUND}: ${apiName}`);
  }

  /**
   * Content Script が注入済みか確認し、未注入なら注入する
   * @private
   */
  async _ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        await new Promise(resolve => setTimeout(resolve, TIMING.CONTENT_SCRIPT_INJECT_WAIT));
      } catch (injectError) {
        throw new Error(`${ERROR_MESSAGES.CONTENT_SCRIPT_INJECTION_FAILED}: ${injectError.message}`);
      }
    }
  }
}
