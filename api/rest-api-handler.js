/**
 * KinDevST REST API実行ハンドラー
 * REST APIの実行フローを管理
 */

'use strict';

import { REST_DOM_IDS, API_TYPES, ERROR_MESSAGES } from '../utils/constants.js';
import { ConfigManager } from '../utils/config-manager.js';
import { HistoryManager } from '../utils/history-manager.js';

/**
 * REST API実行ハンドラークラス
 */
export class RestApiHandler {
  /**
   * @param {Object} options - オプション
   * @param {Object} options.definitionManager - REST API定義マネージャー
   * @param {Object} options.executor - REST API実行クラス
   * @param {Object} options.selector - APIセレクター
   */
  constructor(options) {
    this.definitionManager = options.definitionManager;
    this.executor = options.executor;
    this.selector = options.selector;
  }

  /**
   * 実行ボタンのイベントハンドラーをセットアップ
   */
  setupExecuteButton() {
    const execBtn = document.getElementById(REST_DOM_IDS.EXEC_BTN);
    if (!execBtn) return;
    
    execBtn.addEventListener('click', () => this.execute());
  }

  /**
   * 履歴アイテムからREST APIを再実行
   * @param {Object} historyItem - 履歴アイテム
   */
  async executeWithHistory(historyItem) {
    let params = null;
    if (historyItem.args) {
      try {
        const args = JSON.parse(historyItem.args);
        if (args && args.length > 0) {
          params = args[0];
        }
      } catch (e) {
        // パースエラーは無視
      }
    }
    await this.execute(params, historyItem.apiName);
  }

  /**
   * REST APIを実行
   * @param {Object|null} params - リクエストパラメータ（省略時は入力欄から取得）
   * @param {string|null} apiName - API名（省略時はセレクターから取得）
   */
  async execute(params = null, apiName = null) {
    if (!apiName) {
      apiName = this.selector.getSelectedApiName();
    }
    const bodyInput = document.getElementById(REST_DOM_IDS.BODY);
    
    // メソッドとエンドポイントの取得
    if (!apiName) {
      return;
    }
    
    // API定義から取得（カスタム入力機能は削除）
    const definition = this.definitionManager.getDefinition(apiName);
    if (!definition) {
      return;
    }
    
    const method = definition.method;
    const endpoint = definition.endpoint;
    
    if (!method || !endpoint) {
      return;
    }
    
    try {
      // kintoneドメインを取得（アクティブタブ優先）
      const domain = await ConfigManager.getKintoneDomainForExecution();
      
      // 認証設定を取得
      const authConfig = await ConfigManager.getAuthConfig();
      
      // リクエストパラメータの取得（引数が渡されなかった場合は入力欄から取得）
      if (params === null) {
        if (bodyInput && bodyInput.value.trim()) {
          try {
            params = JSON.parse(bodyInput.value);
          } catch (e) {
            throw new Error(`${ERROR_MESSAGES.JSON_PARSE_ERROR}: ${e.message}`);
          }
        }
      }
      
      // 実行
      const response = await this.executor.execute(apiName, params, domain, authConfig);
      
      // レスポンスがオブジェクトでdataプロパティを持つ場合（ヘッダー情報を含む）
      const result = response?.data !== undefined ? response.data : response;
      const requestHeaders = response?.requestHeaders;
      const statusCode = response?.statusCode;
      const statusText = response?.statusText;
      const responseHeaders = response?.responseHeaders;
      
      // 履歴に保存（ヘッダー情報も含める）
      await HistoryManager.save(API_TYPES.REST, apiName, params ? [params] : [], result, null, requestHeaders, statusCode, statusText, responseHeaders);
      
      // 履歴を再表示（ハンドラーを渡す）
      await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST, null, { rest: this, js: null });
      
    } catch (e) {
      // エラー時でもヘッダー情報を取得（エラーオブジェクトに含まれている場合）
      const requestHeaders = e.requestHeaders || null;
      const statusCode = e.statusCode || null;
      const statusText = e.statusText || null;
      const responseHeaders = e.responseHeaders || null;
      
      let paramsForDisplay = null;
      if (bodyInput && bodyInput.value.trim()) {
        try {
          paramsForDisplay = JSON.parse(bodyInput.value);
        } catch (parseError) {
          // JSONパースエラーの場合は空にする
        }
      }
      
      // エラーも履歴に保存（ヘッダー情報も含める）
      await HistoryManager.save(API_TYPES.REST, apiName, paramsForDisplay ? [paramsForDisplay] : [], null, e, requestHeaders, statusCode, statusText, responseHeaders);
      
      // 履歴を再表示（ハンドラーを渡す）
      await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST, null, { rest: this, js: null });
    }
  }
}
