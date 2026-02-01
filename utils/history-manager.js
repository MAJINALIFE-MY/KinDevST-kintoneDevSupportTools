/**
 * KinDevST 履歴管理モジュール
 * API実行履歴の保存、取得、表示、削除を一元管理
 */

'use strict';

import { STORAGE_KEYS, API_TYPES, CSS_CLASSES, TIMING } from './constants.js';
import { formatCurrentDateTime } from './date-formatter.js';
import { formatArgsForDisplay, formatArgsForRestCopy, formatArgsForJsCopy } from './arg-formatter.js';
import { ConfigManager } from './config-manager.js';

/**
 * 履歴管理クラス
 */
export class HistoryManager {
  /**
   * 実行結果を履歴に保存
   * @param {string} type - API種別 ('rest' | 'js')
   * @param {string} apiName - API名
   * @param {Array<any>} args - 引数
   * @param {any} result - 実行結果
   * @param {Error|null} error - エラー（エラーの場合のみ）
   * @param {Object|null} requestHeaders - リクエストヘッダー（REST APIの場合のみ）
   * @param {Object|null} responseHeaders - レスポンスヘッダー（REST APIの場合のみ）
   * @returns {Promise<void>}
   */
  static async save(type, apiName, args, result, error = null, requestHeaders = null, statusCode = null, statusText = null, responseHeaders = null) {
    const limit = await ConfigManager.getHistoryLimit();
    const { displayTime, timestamp } = formatCurrentDateTime();
    
    const historyItem = {
      type,
      apiName,
      args: JSON.stringify(args),
      result: error ? null : JSON.stringify(result),
      error: error ? error.message : null,
      requestHeaders: requestHeaders ? JSON.stringify(requestHeaders) : null,
      statusCode: statusCode !== null && statusCode !== undefined ? statusCode : null,
      statusText: statusText || null,
      responseHeaders: responseHeaders ? JSON.stringify(responseHeaders) : null,
      timestamp,
      displayTime
    };
    
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
        let history = items[STORAGE_KEYS.HISTORY] || [];
        history.unshift(historyItem); // 先頭に追加
        
        // 上限を超えた分を削除
        if (history.length > limit) {
          history = history.slice(0, limit);
        }
        
        chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history }, resolve);
      });
    });
  }

  /**
   * 履歴を取得
   * @param {string} type - API種別 ('rest' | 'js')
   * @returns {Promise<Array>} 履歴アイテムの配列
   */
  static async getByType(type) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
        const history = items[STORAGE_KEYS.HISTORY] || [];
        resolve(history.filter(item => item.type === type));
      });
    });
  }

  /**
   * 履歴アイテムを削除
   * @param {number} timestamp - 削除するアイテムのタイムスタンプ
   * @returns {Promise<void>}
   */
  static async deleteByTimestamp(timestamp) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
        let history = items[STORAGE_KEYS.HISTORY] || [];
        history = history.filter(h => h.timestamp !== timestamp);
        chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history }, resolve);
      });
    });
  }

  /**
   * 履歴上限に基づいて履歴を整理
   * @returns {Promise<void>}
   */
  static async trimToLimit() {
    const limit = await ConfigManager.getHistoryLimit();
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.HISTORY], (items) => {
        let history = items[STORAGE_KEYS.HISTORY] || [];
        if (history.length > limit) {
          history = history.slice(0, limit);
          chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history }, resolve);
        } else {
          resolve();
        }
      });
    });
  }

  // ハンドラーを保存（削除後の再表示で使用）
  static _handlers = null;

  /**
   * 履歴を表示用のDOM要素に変換
   * @param {string} type - API種別 ('rest' | 'js')
   * @param {string} historyListId - 履歴リストのDOM要素ID
   * @param {Function} onDisplayCallback - 表示完了後のコールバック
   * @param {Object} handlers - 再実行用のハンドラー { rest: RestApiHandler, js: JsApiHandler }
   * @returns {Promise<void>}
   */
  static async display(type, historyListId, onDisplayCallback = null, handlers = null) {
    // ハンドラーを保存（削除後の再表示で使用）
    if (handlers) {
      this._handlers = handlers;
    }
    const historyList = document.getElementById(historyListId);
    if (!historyList) return;
    
    const filteredHistory = await this.getByType(type);
    
    // 初期メッセージを削除
    const selectMessage = historyList.querySelector('.api-select-message');
    if (selectMessage) {
      selectMessage.remove();
    }
    
    historyList.replaceChildren();
    
    if (filteredHistory.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'api-select-message';
      emptyMessage.textContent = '履歴がありません';
      historyList.appendChild(emptyMessage);
      if (onDisplayCallback) onDisplayCallback();
      return;
    }
    
    // ハンドラーが渡されなかった場合は保存されているハンドラーを使用
    const handlersToUse = handlers || this._handlers;
    
    for (const item of filteredHistory) {
      const historyItem = await this._createHistoryItemElement(item, type, historyListId, handlersToUse);
      historyList.appendChild(historyItem);
    }
    
    if (onDisplayCallback) onDisplayCallback();
  }

  /**
   * 履歴アイテムのDOM要素を生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @param {string} type - API種別
   * @param {string} historyListId - 履歴リストのDOM要素ID
   * @param {Object} handlers - 再実行用のハンドラー { rest: RestApiHandler, js: JsApiHandler }
   * @returns {Promise<HTMLElement>}
   */
  static async _createHistoryItemElement(item, type, historyListId, handlers = null) {
    const historyItem = document.createElement('div');
    historyItem.className = CSS_CLASSES.HISTORY_ITEM;
    
    // 日付とボタンのヘッダー行
    const headerRow = document.createElement('div');
    headerRow.className = 'history-item-header-row';
    
    // 日付
    const dateDiv = document.createElement('div');
    dateDiv.className = 'history-item-header';
    dateDiv.textContent = item.displayTime;
    headerRow.appendChild(dateDiv);
    
    // ボタンコンテナ
    const buttonContainer = document.createElement('div');
    buttonContainer.className = CSS_CLASSES.HISTORY_BUTTONS;
    
    // ボタン表示設定を取得
    const buttonDisplayConfig = await ConfigManager.getButtonDisplayConfig();
    
    // 各ボタンを条件付きで追加
    if (buttonDisplayConfig.showRerunButton) {
      const rerunBtn = this._createRerunButton(item, type, historyListId, handlers);
      if (rerunBtn) buttonContainer.appendChild(rerunBtn);
    }
    
    if (buttonDisplayConfig.showCopyButton) {
      buttonContainer.appendChild(this._createCopyButton(item, type));
    }
    
    if (buttonDisplayConfig.showDeleteButton) {
      buttonContainer.appendChild(this._createDeleteButton(item, type, historyListId));
    }
    
    // ボタンが1つでもある場合のみコンテナを追加
    if (buttonContainer.children.length > 0) {
      headerRow.appendChild(buttonContainer);
    }
    historyItem.appendChild(headerRow);
    
    // 実行API
    const apiDiv = document.createElement('div');
    apiDiv.className = 'history-item-api';
    let argsDisplay = '()';
    try {
      const args = JSON.parse(item.args);
      argsDisplay = formatArgsForDisplay(args);
    } catch (e) {
      argsDisplay = item.args || '()';
    }
    // API名から関数名部分を抽出（引数情報を削除）
    // 例: "kintone.api.urlForGet(path, params, isGuestSpace)" -> "kintone.api.urlForGet"
    const displayApiName = item.apiName.replace(/\(.*\)$/, '');
    apiDiv.textContent = `${displayApiName}${argsDisplay}`;
    historyItem.appendChild(apiDiv);
    
    // 表示設定を取得
    let displayConfig = {
      showRequestHeaders: true,
      showStatusCode: true,
      showResponseHeaders: true
    };
    if (type === API_TYPES.REST) {
      displayConfig = await ConfigManager.getRestApiDisplayConfig();
    }
    
    // 最初のlabelかどうかを追跡するフラグ
    let isFirstLabel = true;
    
    // REST APIの場合、リクエストボディを表示
    if (type === API_TYPES.REST && item.args) {
      try {
        const args = JSON.parse(item.args);
        if (args && args.length > 0 && args[0] && Object.keys(args[0]).length > 0) {
          historyItem.appendChild(this._createLabel('Request Body:', isFirstLabel));
          isFirstLabel = false;
          
          const requestBodyPre = this._createPre(JSON.stringify(args[0], null, 2), true);
          historyItem.appendChild(requestBodyPre);
        }
      } catch (e) {
        // パースエラーの場合はスキップ
      }
    }
    
    // REST APIの場合、ヘッダー情報を表示（設定に基づいて表示/非表示を制御）
    if (type === API_TYPES.REST && (item.requestHeaders || item.statusCode !== null || item.responseHeaders)) {
      // Request Headers
      if (item.requestHeaders && displayConfig.showRequestHeaders) {
        historyItem.appendChild(this._createLabel('Request Headers:', isFirstLabel));
        isFirstLabel = false;
        
        let headersText = '(ヘッダーなし)';
        try {
          const headers = JSON.parse(item.requestHeaders);
          headersText = Object.entries(headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n') || '(ヘッダーなし)';
        } catch (e) {
          headersText = item.requestHeaders || '(ヘッダーなし)';
        }
        historyItem.appendChild(this._createPre(headersText, true));
      }
      
      // Status Code
      if (item.statusCode !== null && item.statusCode !== undefined && displayConfig.showStatusCode) {
        historyItem.appendChild(this._createLabel('Status Code:', isFirstLabel));
        isFirstLabel = false;
        
        historyItem.appendChild(this._createPre(`${item.statusCode} ${item.statusText || ''}`.trim(), false));
      }
      
      // Response Headers
      if (item.responseHeaders && displayConfig.showResponseHeaders) {
        historyItem.appendChild(this._createLabel('Response Headers:', isFirstLabel));
        isFirstLabel = false;
        
        let headersText = '(ヘッダーなし)';
        try {
          const headers = JSON.parse(item.responseHeaders);
          headersText = Object.entries(headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n') || '(ヘッダーなし)';
        } catch (e) {
          headersText = item.responseHeaders || '(ヘッダーなし)';
        }
        historyItem.appendChild(this._createPre(headersText, true));
      }
    }
    
    // Response Body:
    historyItem.appendChild(this._createLabel('Response Body:', isFirstLabel));
    
    // 結果
    const resultPre = this._createPre('', false, true);
    
    if (item.error) {
      resultPre.textContent = `エラーが発生しました:\n${item.error}`;
      resultPre.classList.add('history-pre-error');
    } else if (item.result) {
      try {
        const resultObj = JSON.parse(item.result);
        resultPre.textContent = JSON.stringify(resultObj, null, 2);
      } catch (e) {
        resultPre.textContent = item.result;
      }
    } else {
      resultPre.textContent = '結果なし';
    }
    
    historyItem.appendChild(resultPre);
    
    return historyItem;
  }

  /**
   * ラベル要素を生成
   * @private
   * @param {string} text - ラベルテキスト
   * @param {boolean} isFirst - 最初のラベルかどうか
   * @returns {HTMLLabelElement}
   */
  static _createLabel(text, isFirst) {
    const label = document.createElement('label');
    label.textContent = text;
    label.className = 'history-label';
    if (!isFirst) {
      label.classList.add('history-label-margin');
    }
    return label;
  }

  /**
   * pre要素を生成
   * @private
   * @param {string} text - テキスト
   * @param {boolean} scrollable - スクロール可能（200px制限）
   * @param {boolean} large - 大きいサイズ（400px制限）
   * @returns {HTMLPreElement}
   */
  static _createPre(text, scrollable = false, large = false) {
    const pre = document.createElement('pre');
    pre.textContent = text;
    pre.className = 'history-pre';
    if (scrollable) {
      pre.classList.add('history-pre-scrollable');
    }
    if (large) {
      pre.classList.add('history-pre-large');
    }
    return pre;
  }

  /**
   * 再実行ボタンを生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @param {string} type - API種別
   * @param {string} historyListId - 履歴リストのDOM要素ID
   * @param {Object} handlers - 再実行用のハンドラー { rest: RestApiHandler, js: JsApiHandler }
   * @returns {HTMLButtonElement|null}
   */
  static _createRerunButton(item, type, historyListId, handlers) {
    if (!handlers) return null;
    
    const handler = type === API_TYPES.REST ? handlers.rest : handlers.js;
    if (!handler) return null;
    
    const rerunBtn = document.createElement('button');
    rerunBtn.textContent = '再実行';
    rerunBtn.className = CSS_CLASSES.HISTORY_RERUN_BTN;
    
    rerunBtn.addEventListener('click', async () => {
      try {
        await handler.executeWithHistory(item);
        // 履歴を再表示（保存されているハンドラーを使用）
        await HistoryManager.display(type, historyListId, null, this._handlers);
      } catch (e) {
        console.error('再実行に失敗しました:', e);
        this._showButtonFeedback(rerunBtn, 'Error', '#dc3545');
      }
    });
    
    return rerunBtn;
  }

  /**
   * コピーボタンを生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @param {string} type - API種別
   * @returns {HTMLButtonElement}
   */
  static _createCopyButton(item, type) {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'コピー';
    copyBtn.className = CSS_CLASSES.HISTORY_COPY_BTN;
    
    copyBtn.addEventListener('click', async () => {
      try {
        const copyText = await this._generateFullLogText(item, type);
        
        if (copyText) {
          await navigator.clipboard.writeText(copyText);
          this._showButtonFeedback(copyBtn, 'Copied!', '#28a745');
        } else {
          this._showButtonFeedback(copyBtn, 'No data', '#999', 1000);
        }
      } catch (e) {
        console.error('コピーに失敗しました:', e);
        this._showButtonFeedback(copyBtn, 'Error', '#dc3545');
      }
    });
    
    return copyBtn;
  }

  /**
   * 全ログテキストを生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @param {string} type - API種別
   * @returns {Promise<string>} 全ログテキスト
   */
  static async _generateFullLogText(item, type) {
    const lines = [item.displayTime];
    
    // API名と引数の表示形式を生成
    const apiDisplayText = this._formatApiDisplayText(item);
    lines.push(apiDisplayText);
    
    if (type === API_TYPES.REST) {
      // REST API固有の情報を追加
      const displayConfig = await ConfigManager.getRestApiDisplayConfig();
      
      // Request Body
      const requestBody = this._extractRequestBody(item);
      if (requestBody) {
        lines.push('Request Body:', requestBody);
      }
      
      // Request Headers
      if (item.requestHeaders && displayConfig.showRequestHeaders) {
        lines.push('Request Headers:', this._formatHeaders(item.requestHeaders));
      }
      
      // Status Code
      if (item.statusCode !== null && item.statusCode !== undefined && displayConfig.showStatusCode) {
        lines.push('Status Code:', `${item.statusCode} ${item.statusText || ''}`.trim());
      }
      
      // Response Headers
      if (item.responseHeaders && displayConfig.showResponseHeaders) {
        lines.push('Response Headers:', this._formatHeaders(item.responseHeaders));
      }
    }
    
    // Response Body（共通処理）
    lines.push('Response Body:', this._formatResponseBody(item));
    
    return lines.join('\n');
  }

  /**
   * API名と引数の表示形式を生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @returns {string} API名と引数の表示文字列
   */
  static _formatApiDisplayText(item) {
    let argsDisplay = '()';
    try {
      const args = JSON.parse(item.args);
      argsDisplay = formatArgsForDisplay(args);
    } catch (e) {
      argsDisplay = item.args || '()';
    }
    const displayApiName = item.apiName.replace(/\(.*\)$/, '');
    return `${displayApiName}${argsDisplay}`;
  }

  /**
   * Request Bodyを抽出
   * @private
   * @param {Object} item - 履歴アイテム
   * @returns {string|null} Request BodyのJSON文字列（存在しない場合はnull）
   */
  static _extractRequestBody(item) {
    if (!item.args) return null;
    
    try {
      const args = JSON.parse(item.args);
      if (args && args.length > 0 && args[0] && Object.keys(args[0]).length > 0) {
        return JSON.stringify(args[0], null, 2);
      }
    } catch (e) {
      // パースエラーの場合はnullを返す
    }
    return null;
  }

  /**
   * ヘッダーを表示形式に変換
   * @private
   * @param {string} headersJson - JSON文字列化されたヘッダー
   * @returns {string} ヘッダーの表示文字列
   */
  static _formatHeaders(headersJson) {
    try {
      const headers = JSON.parse(headersJson);
      const headersText = Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      return headersText || '(ヘッダーなし)';
    } catch (e) {
      return headersJson || '(ヘッダーなし)';
    }
  }

  /**
   * Response Bodyを表示形式に変換
   * @private
   * @param {Object} item - 履歴アイテム
   * @returns {string} Response Bodyの表示文字列
   */
  static _formatResponseBody(item) {
    if (item.error) {
      return `エラーが発生しました:\n${item.error}`;
    }
    
    if (item.result) {
      try {
        const resultObj = JSON.parse(item.result);
        return JSON.stringify(resultObj, null, 2);
      } catch (e) {
        return item.result;
      }
    }
    
    return '結果なし';
  }

  /**
   * 削除ボタンを生成
   * @private
   * @param {Object} item - 履歴アイテム
   * @param {string} type - API種別
   * @param {string} historyListId - 履歴リストのDOM要素ID
   * @returns {HTMLButtonElement}
   */
  static _createDeleteButton(item, type, historyListId) {
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '削除';
    deleteBtn.className = CSS_CLASSES.HISTORY_DELETE_BTN;
    
    deleteBtn.addEventListener('click', async () => {
      await this.deleteByTimestamp(item.timestamp);
      // 保存されているハンドラーを使用して再表示
      await this.display(type, historyListId, null, this._handlers);
    });
    
    return deleteBtn;
  }

  /**
   * ボタンのフィードバック表示
   * @private
   * @param {HTMLButtonElement} button - ボタン要素
   * @param {string} text - 表示テキスト
   * @param {string} color - 背景色
   * @param {number} duration - 表示時間（ミリ秒）
   */
  static _showButtonFeedback(button, text, color, duration = TIMING.BUTTON_FEEDBACK_DISPLAY) {
    const originalText = button.textContent;
    button.textContent = text;
    button.style.backgroundColor = color;
    setTimeout(() => {
      button.textContent = originalText;
      button.style.backgroundColor = '';
    }, duration);
  }
}
