/**
 * KinDevST Body 系 API 実行ハンドラー（REST API / User API 共通）
 * Body / Query 入力 → params 構築 → 実行 → 履歴保存の共通フローを管理する。
 * REST API と User API は DOM ID と API 種別のみが異なるため本クラスを共有する。
 */

'use strict';

import { ERROR_MESSAGES } from '../utils/constants.js';
import { ConfigManager } from '../utils/config-manager.js';
import { HistoryManager } from '../utils/history-manager.js';
import { setButtonLoading, showInputError } from '../ui/ui-helpers.js';
import { showToast } from '../ui/toast.js';

export class BodyApiHandler {
  /**
   * @param {Object} options
   * @param {Object} options.definitionManager - API定義マネージャー
   * @param {Object} options.executor - API実行クラス
   * @param {Object} options.selector - APIセレクター
   * @param {Object} options.domIds - DOM ID セット（EXEC_BTN / BODY / HISTORY_LIST を含む）
   * @param {string} options.apiType - API種別（API_TYPES.REST | API_TYPES.USER）
   */
  constructor(options) {
    this.definitionManager = options.definitionManager;
    this.executor = options.executor;
    this.selector = options.selector;
    this.domIds = options.domIds;
    this.apiType = options.apiType;
    this._isExecuting = false;
  }

  setupExecuteButton() {
    const execBtn = document.getElementById(this.domIds.EXEC_BTN);
    if (!execBtn) return;
    execBtn.addEventListener('click', () => this.execute());
  }

  /**
   * 履歴アイテムから再実行
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
   * API を実行
   * @param {Object|null} params - リクエストパラメータ（省略時は入力欄から取得）
   * @param {string|null} apiName - API名（省略時はセレクターから取得）
   */
  async execute(params = null, apiName = null) {
    if (this._isExecuting) return;

    if (!apiName) {
      apiName = this.selector.getSelectedApiName();
    }
    if (!apiName) {
      showToast('APIを選択してください', { type: 'info' });
      return;
    }

    const definition = this.definitionManager.getDefinition(apiName);
    if (!definition || !definition.method || !definition.endpoint) {
      showToast(ERROR_MESSAGES.API_DEFINITION_NOT_FOUND, { type: 'error' });
      return;
    }

    const bodyInput = document.getElementById(this.domIds.BODY);

    // JSON構文エラーは実行前に検証し、履歴には残さない
    if (params === null && bodyInput && bodyInput.value.trim()) {
      try {
        params = JSON.parse(bodyInput.value);
      } catch (e) {
        showInputError(bodyInput, `${ERROR_MESSAGES.JSON_PARSE_ERROR}: ${e.message}`);
        return;
      }
    }

    const execBtn = document.getElementById(this.domIds.EXEC_BTN);
    this._isExecuting = true;
    setButtonLoading(execBtn, true);

    try {
      const domain = await ConfigManager.getKintoneDomainForExecution();
      const authConfig = ConfigManager.getAuthConfig();

      const response = await this.executor.execute(apiName, params, domain, authConfig);

      // レスポンスがヘッダー情報を含むオブジェクトの場合に対応
      const result = response?.data !== undefined ? response.data : response;
      await HistoryManager.save(
        this.apiType, apiName, params ? [params] : [], result, null,
        response?.requestHeaders, response?.statusCode, response?.statusText, response?.responseHeaders,
        definition.method
      );
      await HistoryManager.display(this.apiType, this.domIds.HISTORY_LIST);
      this._scrollToLatest();
      showToast('実行しました', { type: 'success' });
    } catch (e) {
      await HistoryManager.save(
        this.apiType, apiName, params ? [params] : [], null, e,
        e.requestHeaders || null, e.statusCode || null, e.statusText || null, e.responseHeaders || null,
        definition.method
      );
      await HistoryManager.display(this.apiType, this.domIds.HISTORY_LIST);
      this._scrollToLatest();
      showToast(`エラー: ${e.message}`, { type: 'error' });
    } finally {
      this._isExecuting = false;
      setButtonLoading(execBtn, false);
    }
  }

  /**
   * 最新の実行結果までスクロール
   * @private
   */
  _scrollToLatest() {
    const historyList = document.getElementById(this.domIds.HISTORY_LIST);
    historyList?.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
