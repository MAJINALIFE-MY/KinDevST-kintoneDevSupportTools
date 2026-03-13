/**
 * KinDevST API表示更新モジュール
 * 選択されたAPIに応じてUIを更新する処理を管理
 */

'use strict';

import { CSS_CLASSES, UI_CONFIG } from '../utils/constants.js';
import {
  createSampleButton,
  showSelectMessage,
  hideSelectMessage,
  createLabelContainer,
  setupAutoResize
} from './ui-helpers.js';

/**
 * URLがhttp://またはhttps://で始まることを確認
 * @param {string} url - 検証するURL
 * @returns {boolean} 有効なURLの場合true
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const trimmedUrl = url.trim();
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
}

/**
 * ドキュメントリンクを表示/更新
 * @param {HTMLElement} docLinkDiv - ドキュメントリンクのコンテナ要素
 * @param {string|null} docUrl - ドキュメントURL
 */
export function updateDocLink(docLinkDiv, docUrl) {
  if (!docLinkDiv) return;
  
  const docLinkA = docLinkDiv.querySelector('a');
  if (!docLinkA) return;
  
  if (docUrl && !docUrl.startsWith('//Todo:')) {
    // URL検証: http://またはhttps://で始まることを確認
    if (isValidUrl(docUrl)) {
      docLinkA.href = docUrl;
      docLinkA.textContent = '📖 ドキュメントを開く';
      docLinkA.style.pointerEvents = 'auto';
      docLinkA.style.color = '';
      docLinkA.style.textDecoration = '';
      docLinkA.style.cursor = '';
      docLinkDiv.style.display = 'flex';
    } else {
      // 無効なURLの場合はリンクを無効化
      console.warn('[KinDevST] 無効なURLが検出されました:', docUrl);
      docLinkA.href = '#';
      docLinkA.textContent = '📖 ドキュメントを開く（無効なURL）';
      docLinkA.style.pointerEvents = 'none';
      docLinkA.style.color = '#999';
      docLinkA.style.textDecoration = 'none';
      docLinkA.style.cursor = 'default';
      docLinkDiv.style.display = 'flex';
    }
  } else if (docUrl && docUrl.startsWith('//Todo:')) {
    // Todoコメントの場合はテキストとして表示
    docLinkA.href = '#';
    docLinkA.textContent = docUrl;
    docLinkA.style.pointerEvents = 'none';
    docLinkA.style.color = '#999';
    docLinkA.style.textDecoration = 'none';
    docLinkA.style.cursor = 'default';
    docLinkDiv.style.display = 'flex';
  } else {
    docLinkDiv.style.display = 'none';
  }
}

/**
 * REST API表示管理クラス
 */
export class RestApiDisplay {
  /**
   * @param {Object} options - オプション
   * @param {Object} options.definitionManager - REST API定義マネージャー
   * @param {string} options.docLinkId - ドキュメントリンクのID
   * @param {string} options.infoDisplayId - 情報表示のID
   * @param {string} options.bodyInputId - Body入力のID
   */
  constructor(options) {
    this.definitionManager = options.definitionManager;
    this.docLinkId = options.docLinkId;
    this.infoDisplayId = options.infoDisplayId;
    this.bodyInputId = options.bodyInputId;
    this.historyListId = options.historyListId || 'rest-history-list';
    this.currentSampleButton = null;
  }

  /**
   * 選択されたAPIに応じてUIを更新
   * @param {string} apiName - API名
   */
  update(apiName) {
    const docLinkDiv = document.getElementById(this.docLinkId);
    const apiInfoDisplay = document.getElementById(this.infoDisplayId);
    const bodyInput = document.getElementById(this.bodyInputId);
    
    // 選択なしの場合
    if (!apiName) {
      if (docLinkDiv) docLinkDiv.style.display = 'none';
      if (apiInfoDisplay) apiInfoDisplay.style.display = 'none';
      if (bodyInput) {
        bodyInput.value = '';
        bodyInput.placeholder = '';
      }
      showSelectMessage(this.historyListId);
      return;
    }
    
    hideSelectMessage(this.historyListId);
    
    const definition = this.definitionManager.getDefinition(apiName);
    if (!definition) return;
    
    // Body入力欄をクリア
    if (bodyInput) {
      bodyInput.value = '';
      bodyInput.placeholder = definition.bodyPlaceholder || '';
    }
    
    // ドキュメントリンク表示
    updateDocLink(docLinkDiv, definition.docUrl);
    
    // API情報を表示エリアに設定
    if (apiInfoDisplay) {
      apiInfoDisplay.style.display = 'block';
      const methodSpan = apiInfoDisplay.querySelector('.api-method');
      const endpointSpan = apiInfoDisplay.querySelector('.api-endpoint');
      if (methodSpan) methodSpan.textContent = definition.method || '';
      if (endpointSpan) endpointSpan.textContent = definition.endpoint || '';
    }
    
    // Body入力欄にサンプルボタンを追加
    this._updateBodyInputSampleButton(definition);
  }
  
  /**
   * Body入力欄にサンプルボタンを追加/更新
   * @private
   * @param {Object} definition - API定義
   */
  _updateBodyInputSampleButton(definition) {
    const bodyInput = document.getElementById(this.bodyInputId);
    if (!bodyInput) return;
    
    const formGroup = bodyInput.closest('.form-group');
    if (!formGroup) return;
    
    const existingLabelContainer = formGroup.querySelector('.label-with-button');
    const label = formGroup.querySelector('label');
    
    // 既存のサンプルボタンを削除
    if (this.currentSampleButton && this.currentSampleButton.parentNode) {
      this.currentSampleButton.parentNode.removeChild(this.currentSampleButton);
      this.currentSampleButton = null;
    }
    
    if (existingLabelContainer) {
      const existingButtons = existingLabelContainer.querySelectorAll(`.${CSS_CLASSES.SAMPLE_INPUT_BTN}`);
      existingButtons.forEach(btn => btn.remove());
    }
    
    const placeholderText = definition.bodyPlaceholder;
    if (placeholderText && label) {
      let labelContainer = existingLabelContainer;
      
      if (!labelContainer) {
        labelContainer = createLabelContainer(label);
        formGroup.insertBefore(labelContainer, bodyInput);
      }
      
      // 共通ヘルパーを使用してサンプルボタンを作成
      this.currentSampleButton = createSampleButton(bodyInput, placeholderText);
      labelContainer.appendChild(this.currentSampleButton);
    } else {
      if (existingLabelContainer && label) {
        if (existingLabelContainer.contains(label)) {
          formGroup.insertBefore(label, bodyInput);
        }
        existingLabelContainer.remove();
      }
    }
  }
}

/**
 * JS API表示管理クラス
 */
export class JsApiDisplay {
  /**
   * @param {Object} options - オプション
   * @param {Object} options.definitionManager - JS API定義マネージャー
   * @param {string} options.docLinkId - ドキュメントリンクのID
   * @param {string} options.argsContainerId - 引数コンテナのID
   * @param {string} options.historyListId - 履歴リストのID
   */
  constructor(options) {
    this.definitionManager = options.definitionManager;
    this.docLinkId = options.docLinkId;
    this.argsContainerId = options.argsContainerId;
    this.historyListId = options.historyListId || 'js-history-list';
  }

  /**
   * 選択されたAPIに応じてUIを更新
   * @param {string} apiName - API名
   */
  update(apiName) {
    const docLinkDiv = document.getElementById(this.docLinkId);
    const argsContainer = document.getElementById(this.argsContainerId);
    
    if (!argsContainer) return;
    argsContainer.replaceChildren();
    
    if (!apiName) {
      if (docLinkDiv) docLinkDiv.style.display = 'none';
      showSelectMessage(this.historyListId);
      return;
    }
    
    hideSelectMessage(this.historyListId);
    
    const definition = this.definitionManager.getDefinition(apiName);
    if (!definition) return;
    
    // ドキュメントリンク表示
    updateDocLink(docLinkDiv, definition.docUrl);
    
    // 引数入力欄の生成
    if (!definition.args || definition.args.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'no-args-message';
      msg.textContent = '※このAPIは引数がありません';
      argsContainer.appendChild(msg);
    } else {
      definition.args.forEach((arg, index) => {
        const group = this._createArgInputGroup(arg, index);
        argsContainer.appendChild(group);
      });
    }
  }

  /**
   * 引数入力グループを生成
   * @private
   * @param {Object} arg - 引数定義
   * @param {number} index - インデックス
   * @returns {HTMLElement}
   */
  _createArgInputGroup(arg, index) {
    const group = document.createElement('div');
    group.className = CSS_CLASSES.FORM_GROUP;
    
    // ラベル作成
    const label = document.createElement('label');
    label.textContent = `第${index + 1}引数 ${arg.name ? `(${arg.name})` : ''}`;
    
    if (arg.type === 'function' || (arg.required === false && arg.type === 'function')) {
      label.className = 'arg-label-disabled';
      label.textContent += ' [コールバック関数 - 省略可]';
    } else if (arg.required === false) {
      label.textContent += ' [省略可]';
    }
    
    // 入力欄作成
    const input = document.createElement('textarea');
    input.className = CSS_CLASSES.JS_ARG_INPUT;
    input.dataset.index = index;
    const placeholderText = arg.placeholder || '';
    input.placeholder = placeholderText;
    
    // 関数型の引数は無効化
    if (arg.type === 'function') {
      input.disabled = true;
      input.className += ' input-disabled';
      input.placeholder = '※コールバック関数は省略可（Promiseで処理）';
    } else {
      if (arg.defaultValue !== undefined) {
        input.value = typeof arg.defaultValue === 'object' 
          ? JSON.stringify(arg.defaultValue) 
          : arg.defaultValue;
      }
    }
    
    // スタイル調整（デフォルト1行、高さは倍率適用）
    input.rows = 1;
    // CSSのmin-heightを上書きして1行の高さ（倍率適用）に設定
    const lineHeight = parseInt(window.getComputedStyle(input).lineHeight) || 20;
    const adjustedHeight = Math.round(lineHeight * UI_CONFIG.JS_ARG_INPUT_HEIGHT_MULTIPLIER);
    input.style.minHeight = adjustedHeight + 'px';
    input.style.height = adjustedHeight + 'px';
    
    // 高さ自動調整機能（共通ヘルパーを使用、JS APIは制限なしで自動改行）
    setupAutoResize(input, Infinity);
    
    // サンプル入力ボタン（共通ヘルパーを使用）
    let sampleButton = null;
    if (placeholderText && arg.type !== 'function') {
      sampleButton = createSampleButton(input, placeholderText);
    }
    
    // ラベルとボタンをまとめるコンテナ（共通ヘルパーを使用）
    const labelContainer = createLabelContainer(label, sampleButton);
    
    group.appendChild(labelContainer);
    
    // type表示（存在する場合）
    if (arg.type) {
      const typeElement = document.createElement('div');
      typeElement.className = 'arg-description';
      typeElement.textContent = `type: ${arg.type}`;
      group.appendChild(typeElement);
    }
    
    // description表示（存在する場合）
    if (arg.description) {
      const descElement = document.createElement('div');
      descElement.className = 'arg-description';
      descElement.textContent = arg.description;
      group.appendChild(descElement);
    }
    
    group.appendChild(input);
    
    return group;
  }
}
