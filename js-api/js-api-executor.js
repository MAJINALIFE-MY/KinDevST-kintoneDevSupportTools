'use strict';

import { ERROR_MESSAGES } from '../utils/constants.js';

// API実行クラス
export class JSAPIExecutor {
  constructor(definitionManager) {
    this.definitionManager = definitionManager;
  }

  /**
   * アクティブなタブでAPIを実行
   * @param {string} apiName - API名
   * @param {Array<any>} args - 引数の配列
   * @returns {Promise<any>} 実行結果
   */
  async executeInActiveTab(apiName, args) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error(ERROR_MESSAGES.NO_ACTIVE_TAB);
    }

    // URLチェック (簡易)
    if (!tab.url || !tab.url.includes('.cybozu.com')) {
      throw new Error(ERROR_MESSAGES.NOT_KINTONE_PAGE_DETAIL);
    }

    return this.execute(apiName, args, tab.id);
  }

  /**
   * 指定タブでAPIを実行
   * @param {string} apiName - API名
   * @param {Array<any>} args - 引数の配列
   * @param {number} tabId - タブID
   * @returns {Promise<any>} 実行結果
   */
  async execute(apiName, args, tabId) {
    const definition = this.definitionManager.getDefinition(apiName);
    
    if (!definition) {
      throw new Error(`${ERROR_MESSAGES.API_DEFINITION_NOT_FOUND}: ${apiName}`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: 'MAIN', // MAINワールドで実行
      func: executeInMainWorld,
      args: [apiName, args, definition.returnsPromise ?? false]
    });

    if (!results || results.length === 0) {
      throw new Error(ERROR_MESSAGES.EXECUTION_RESULT_EMPTY);
    }

    const result = results[0];
    if (result.result && result.result.error) {
      throw new Error(result.result.error);
    }
    
    return result.result;
  }
}

/**
 * MAINワールドで実行される関数
 * @param {string} apiName 
 * @param {Array<any>} args 
 * @param {boolean} returnsPromise 
 */
async function executeInMainWorld(apiName, args, returnsPromise) {
  try {
    if (typeof window.kintone === 'undefined') {
      return { error: 'kintoneオブジェクトが見つかりません。kintoneのページを開いているか確認してください。' };
    }

    // 関数名部分を抽出（引数情報を削除）
    // 例: "kintone.api.urlForGet(path, params, isGuestSpace)" -> "kintone.api.urlForGet"
    const actualApiName = apiName.replace(/\(.*\)$/, '');

    // ネストされたAPI名を解決 (例: 'kintone.app.get' -> window.kintone.app.get)
    const parts = actualApiName.split('.');
    let func = window;
    let context = window;

    for (const part of parts) {
      context = func;
      func = func[part];
      if (!func) {
        return { error: `API関数が見つかりません: ${actualApiName} (元のAPI名: ${apiName})` };
      }
    }

    // 末尾のundefined/null引数を削除（kintone.proxyなど、undefined/nullを明示的に受け取るとエラーになるAPIに対応）
    // chrome.scripting.executeScriptでundefinedがnullに変換される可能性があるため、nullも削除対象に含める
    // 配列のコピーを作成してから末尾のundefined/nullを削除
    const cleanedArgs = Array.isArray(args) ? [...args] : args;
    while (Array.isArray(cleanedArgs) && cleanedArgs.length > 0 && 
           (cleanedArgs[cleanedArgs.length - 1] === undefined || cleanedArgs[cleanedArgs.length - 1] === null)) {
      cleanedArgs.pop();
    }

    // 実行
    let result;
    if (returnsPromise) {
      result = await func.apply(context, cleanedArgs);
    } else {
      result = func.apply(context, cleanedArgs);
    }

    // 結果がundefinedの場合の処理（JSONシリアライズ対策）
    if (result === undefined) {
      return 'undefined';
    }
    
    // DOM要素のシリアライズ対策（HTMLElementはJSONシリアライズできないため）
    return serializeResult(result);
    
    /**
     * 結果をシリアライズ可能な形式に変換
     * DOM要素の場合は基本情報を含むオブジェクトに変換
     * @param {any} value - 変換対象
     * @returns {any} シリアライズ可能な値
     */
    function serializeResult(value) {
      // nullやプリミティブはそのまま返す
      if (value === null || typeof value !== 'object') {
        return value;
      }
      
      // HTMLElementの場合
      if (value instanceof HTMLElement) {
        return serializeElement(value);
      }
      
      // NodeListやHTMLCollectionの場合
      if (value instanceof NodeList || value instanceof HTMLCollection) {
        return Array.from(value).map(el => 
          el instanceof HTMLElement ? serializeElement(el) : el
        );
      }
      
      // 配列の場合（中にDOM要素が含まれている可能性）
      if (Array.isArray(value)) {
        return value.map(item => 
          item instanceof HTMLElement ? serializeElement(item) : item
        );
      }
      
      // その他のオブジェクトはそのまま返す
      return value;
    }
    
    /**
     * HTMLElementをシリアライズ可能なオブジェクトに変換
     * @param {HTMLElement} el - DOM要素
     * @returns {Object} シリアライズ可能なオブジェクト
     */
    function serializeElement(el) {
      const outerHTML = el.outerHTML || '';
      return {
        __type: 'HTMLElement',
        tagName: el.tagName,
        id: el.id || null,
        className: el.className || null,
        textContent: el.textContent ? el.textContent.substring(0, 200) : null,
        outerHTML: outerHTML.length > 1000 ? outerHTML.substring(0, 1000) + '...' : outerHTML
      };
    }

  } catch (e) {
    return { error: `実行時エラー: ${e.message}\n${e.stack}` };
  }
}
