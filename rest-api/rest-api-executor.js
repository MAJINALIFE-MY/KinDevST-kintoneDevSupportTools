'use strict';

import { TIMING, ERROR_MESSAGES } from '../utils/constants.js';
import { ConfigManager } from '../utils/config-manager.js';

// REST API実行クラス
export class RESTAPIExecutor {
  constructor(definitionManager) {
    this.definitionManager = definitionManager;
  }

  /**
   * REST APIを実行する（Background Service Worker経由）
   * @param {string} apiName - API名（例: "GET /k/v1/record.json"）
   * @param {Object} params - リクエストパラメータ（クエリパラメータやボディ）
   * @param {string} domain - kintoneドメイン（例: "example.cybozu.com"）
   * @param {Object} authConfig - 認証設定
   * @returns {Promise<Object>} 実行結果
   */
  async execute(apiName, params, domain, authConfig) {
    let method, endpoint;
    
    // API定義から取得を試みる
    const definition = this.definitionManager.getDefinition(apiName);
    if (definition) {
      method = definition.method;
      endpoint = definition.endpoint;
    } else {
      // 定義が見つからない場合は、apiNameから解析（例: "GET /k/v1/record.json"）
      const parts = apiName.split(' ');
      if (parts.length >= 2) {
        method = parts[0];
        endpoint = parts.slice(1).join(' ');
      } else {
        throw new Error(`${ERROR_MESSAGES.API_DEFINITION_NOT_FOUND}: ${apiName}`);
      }
    }

    // 認証方式に応じて実行方法を選択
    const authType = authConfig?.authType || 'session';
    
    // セッション認証の場合はBackground Service Worker経由で実行（CSRFトークン取得のため）
    if (authType === 'session') {
      // kintoneタブIDを取得（アクティブタブ優先）
      const tabId = await ConfigManager.getKintoneTabIdForExecution();
      
      // Content Scriptが既に注入されているか確認
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      } catch (e) {
        // Content Scriptが注入されていない場合は注入
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content-script.js']
          });
          // 注入後、少し待つ
          await new Promise(resolve => setTimeout(resolve, TIMING.CONTENT_SCRIPT_INJECT_WAIT));
        } catch (injectError) {
          throw new Error(`${ERROR_MESSAGES.CONTENT_SCRIPT_INJECTION_FAILED}: ${injectError.message}`);
        }
      }
      
      // Background Service Worker経由で実行（CSRFトークン取得のため）
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'REST_API_EXECUTE',
          apiName,
          method,
          endpoint,
          params,
          domain,
          authConfig,
          tabId  // タブIDを渡す
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
    
    // その他の認証方式はBackground Service Worker経由で実行
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'REST_API_EXECUTE',
        apiName,
        method,
        endpoint,
        params,
        domain,
        authConfig
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
}
