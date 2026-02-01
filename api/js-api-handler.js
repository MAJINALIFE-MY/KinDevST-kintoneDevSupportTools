/**
 * KinDevST JS API実行ハンドラー
 * JS APIの実行フローを管理
 */

'use strict';

import { JS_DOM_IDS, API_TYPES, CSS_CLASSES } from '../utils/constants.js';
import { parseArgValue } from '../utils/arg-formatter.js';
import { HistoryManager } from '../utils/history-manager.js';
import { ConfigManager } from '../utils/config-manager.js';

/**
 * JS API実行ハンドラークラス
 */
export class JsApiHandler {
  /**
   * @param {Object} options - オプション
   * @param {Object} options.definitionManager - JS API定義マネージャー
   * @param {Object} options.executor - JS API実行クラス
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
    const execBtn = document.getElementById(JS_DOM_IDS.EXEC_BTN);
    if (!execBtn) return;
    
    execBtn.addEventListener('click', () => this.execute());
  }

  /**
   * 履歴アイテムからJS APIを再実行
   * @param {Object} historyItem - 履歴アイテム
   */
  async executeWithHistory(historyItem) {
    let args = [];
    if (historyItem.args) {
      try {
        args = JSON.parse(historyItem.args);
      } catch (e) {
        // パースエラーは無視
      }
    }
    await this.execute(args, historyItem.apiName);
  }

  /**
   * JS APIを実行
   * @param {Array|null} args - 引数（省略時は入力欄から取得）
   * @param {string|null} apiName - API名（省略時はセレクターから取得）
   */
  async execute(args = null, apiName = null) {
    if (!apiName) {
      apiName = this.selector.getSelectedApiName();
    }
    
    if (!apiName) {
      return;
    }

    // 引数の取得（引数が渡されなかった場合は入力欄から取得）
    if (args === null) {
      const definition = this.definitionManager.getDefinition(apiName);
      const argsInputs = document.querySelectorAll(`.${CSS_CLASSES.JS_ARG_INPUT}`);
      args = [];
      
      if (definition && definition.args) {
        // 定義に基づいて引数を構築（関数型の引数は除外）
        definition.args.forEach((argDef, index) => {
          // 関数型の引数はスキップ（コールバック関数はJSONで渡せないため）
          if (argDef.type === 'function') {
            return;
          }
          
          const input = argsInputs[index];
          
          // 入力欄がない場合の処理
          if (!input) {
            if (argDef.required === false) {
              return; // 省略可能な引数は追加しない
            }
            // 必須引数: defaultValueがあれば使用、なければundefined
            args.push(argDef.defaultValue !== undefined ? argDef.defaultValue : undefined);
            return;
          }
          
          // 入力値の解析
          const value = parseArgValue(input.value);
          const isEmpty = value === undefined || value === null || value === '';
          
          // 空の値の場合の処理
          if (isEmpty) {
            if (argDef.required === false) {
              // 省略可能: オブジェクト型の場合は空オブジェクトを渡す（互換性のため）
              if (argDef.type === 'object') {
                args.push({});
              }
              // その他の型は引数を追加しない
              return;
            }
            
            // 必須引数: defaultValueがあれば使用、なければundefined
            // （末尾のundefinedはjs-api-executor.jsで削除される）
            args.push(argDef.defaultValue !== undefined ? argDef.defaultValue : undefined);
            return;
          }
          
          // 有効な値がある場合はそのまま追加
          args.push(value);
        });
      } else {
        // 定義がない場合は従来通り処理
        argsInputs.forEach((input) => {
          if (input.disabled) {
            return; // 無効化された入力欄はスキップ
          }
          args.push(parseArgValue(input.value));
        });
      }
    }
    
    try {
      
      // kintoneタブIDを取得（アクティブタブ優先、後方互換性のため失敗時はnullを返す）
      let tabId = null;
      try {
        tabId = await ConfigManager.getKintoneTabIdForExecution();
      } catch (e) {
        // タブが見つからない場合は従来通りアクティブタブを使用（後方互換性）
        tabId = null;
      }
      
      // 実行
      const result = tabId 
        ? await this.executor.execute(apiName, args, tabId)
        : await this.executor.executeInActiveTab(apiName, args);
      
      // 履歴に保存
      await HistoryManager.save(API_TYPES.JS, apiName, args, result);
      
      // 履歴を再表示（ハンドラーを渡す）
      await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST, null, { rest: null, js: this });
      
    } catch (e) {
      // エラーも履歴に保存
      await HistoryManager.save(API_TYPES.JS, apiName, args, null, e);
      
      // 履歴を再表示（ハンドラーを渡す）
      await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST, null, { rest: null, js: this });
    }
  }
}
