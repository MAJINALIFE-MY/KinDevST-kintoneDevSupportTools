/**
 * KinDevST APIセレクターモジュール
 * REST APIとJS APIで共通のSelect2セレクターの初期化と同期処理を管理
 */

'use strict';

import { SELECT2_OPTIONS, TIMING } from '../utils/constants.js';

/**
 * APIセレクター管理クラス
 * REST APIとJS APIで共通のSelect2セレクター処理を管理
 */
export class ApiSelector {
  /**
   * @param {Object} options - セレクターオプション
   * @param {string} options.displaySelectorId - 表示名セレクターのID
   * @param {string} options.nameSelectorId - API名セレクターのID
   * @param {Object} options.definitionManager - API定義マネージャー
   * @param {Function} options.onSelect - 選択時のコールバック
   * @param {boolean} options.showDuplicateFlag - 重複フラグを表示するか
   */
  constructor(options) {
    this.displaySelectorId = options.displaySelectorId;
    this.nameSelectorId = options.nameSelectorId;
    this.definitionManager = options.definitionManager;
    this.onSelect = options.onSelect || (() => {});
    this.showDuplicateFlag = options.showDuplicateFlag || false;
    
    this.displaySelector = null;
    this.nameSelector = null;
    this.isSyncing = false;
  }

  /**
   * セレクターを初期化
   */
  initialize() {
    this.displaySelector = document.getElementById(this.displaySelectorId);
    this.nameSelector = document.getElementById(this.nameSelectorId);
    
    if (!this.displaySelector || !this.nameSelector) {
      console.error('セレクター要素が見つかりません');
      return;
    }
    
    this._populateOptions();
    this._initSelect2();
    this._setupSyncHandlers();
    
    // 初期化完了後、空の状態を確実にする（コールバックは呼ばない）
    this.isSyncing = true;
    const $ = window.jQuery || window.$;
    if ($) {
      $(this.displaySelector).val(null).trigger('change.select2');
      $(this.nameSelector).val(null).trigger('change.select2');
    }
    this.isSyncing = false;
  }

  /**
   * オプションをセレクターに追加
   * @private
   */
  _populateOptions() {
    const categories = this.definitionManager.getCategories();
    
    // 既存のオプションをクリア
    this.displaySelector.replaceChildren();
    this.nameSelector.replaceChildren();
    
    // カテゴリごとにグループ化して追加
    categories.forEach(category => {
      const groupDisplay = document.createElement('optgroup');
      groupDisplay.label = category.category;
      
      const groupName = document.createElement('optgroup');
      groupName.label = category.category;
      
      if (category.apis) {
        category.apis.forEach(api => {
          // 重複フラグの確認
          const isDuplicate = !!api.duplicate;
          
          // 表示名を取得（重複APIの場合は参照先から取得）
          let displayName = api.displayName;
          if (!displayName && isDuplicate && api.duplicate) {
            const originalDefinition = this.definitionManager.getDefinition(api.duplicate);
            if (originalDefinition && originalDefinition.displayName) {
              displayName = `【重複】${originalDefinition.displayName}`;
            }
          } else if (isDuplicate && displayName && !displayName.startsWith('【重複】')) {
            // 既に解決済みで【重複】が付いていない場合は付与
            displayName = `【重複】${displayName}`;
          }
          
          // 表示名が取得できない場合はAPI名を使用
          if (!displayName) {
            displayName = api.name;
          }
          
          // 表示名用のオプション
          const optionDisplay = document.createElement('option');
          optionDisplay.value = api.name;
          optionDisplay.textContent = displayName;
          groupDisplay.appendChild(optionDisplay);
          
          // API名用のオプション
          const optionName = document.createElement('option');
          optionName.value = api.name;
          // 重複の場合は【重複】を付与（showDuplicateFlagがtrueの場合のみ）
          optionName.textContent = (this.showDuplicateFlag && isDuplicate) 
            ? `【重複】${api.name}` 
            : api.name;
          groupName.appendChild(optionName);
        });
      }
      
      this.displaySelector.appendChild(groupDisplay);
      this.nameSelector.appendChild(groupName);
    });
  }

  /**
   * Select2を初期化
   * @private
   */
  _initSelect2() {
    const $ = window.jQuery || window.$;
    
    if (!$) {
      console.error('jQuery is not loaded');
      return;
    }
    
    // 初期値をクリア（何も選択されていない状態にする）
    this.displaySelector.value = '';
    this.nameSelector.value = '';
    
    // Select2の初期化（表示名用）
    $(this.displaySelector).select2(SELECT2_OPTIONS.DISPLAY);
    
    // Select2の初期化（API名用）
    $(this.nameSelector).select2(SELECT2_OPTIONS.NAME);
  }

  /**
   * 同期ハンドラーをセットアップ
   * @private
   */
  _setupSyncHandlers() {
    const $ = window.jQuery || window.$;
    
    if (!$) return;
    
    // 表示名セレクターが変更されたとき
    $(this.displaySelector).on('select2:select select2:clear', () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      
      const apiName = $(this.displaySelector).val();
      $(this.nameSelector).val(apiName).trigger('change.select2');
      this.onSelect(apiName || '');
      
      this.isSyncing = false;
    });
    
    // API名セレクターが変更されたとき
    $(this.nameSelector).on('select2:select select2:clear', () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      
      const apiName = $(this.nameSelector).val();
      $(this.displaySelector).val(apiName).trigger('change.select2');
      this.onSelect(apiName || '');
      
      this.isSyncing = false;
    });
  }

  /**
   * 現在選択されているAPI名を取得
   * @returns {string|null} API名
   */
  getSelectedApiName() {
    const $ = window.jQuery || window.$;
    if (!$) return null;
    
    return $(this.displaySelector).val() || $(this.nameSelector).val() || null;
  }

  /**
   * セレクターの値をプログラム的に設定
   * @param {string} apiName - API名
   */
  setSelectedApiName(apiName) {
    const $ = window.jQuery || window.$;
    if (!$) return;
    
    this.isSyncing = true;
    $(this.displaySelector).val(apiName).trigger('change.select2');
    $(this.nameSelector).val(apiName).trigger('change.select2');
    this.isSyncing = false;
  }

  /**
   * セレクターをクリア
   */
  clear() {
    const $ = window.jQuery || window.$;
    if (!$) return;
    
    $(this.displaySelector).val(null).trigger('change.select2');
    $(this.nameSelector).val(null).trigger('change.select2');
  }
}

/**
 * jQueryが読み込まれるまで待つ
 * @returns {Promise<void>}
 */
export function waitForJQuery() {
  return new Promise((resolve) => {
    if (window.jQuery || window.$) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.jQuery || window.$) {
          clearInterval(checkInterval);
          resolve();
        }
      }, TIMING.JQUERY_WAIT_INTERVAL);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(); // タイムアウトしても続行
      }, TIMING.JQUERY_WAIT_TIMEOUT);
    }
  });
}
