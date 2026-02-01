/**
 * KinDevST UI共通ヘルパーモジュール
 * RestApiDisplayとJsApiDisplayで共通のUI処理を提供
 */

'use strict';

import { CSS_CLASSES, UI_CONFIG } from '../utils/constants.js';

/**
 * サンプル入力ボタンを生成
 * @param {HTMLTextAreaElement} input - 入力要素
 * @param {string} placeholderText - プレースホルダーテキスト
 * @param {Function|null} onHeightAdjust - 高さ調整関数（オプション）
 * @returns {HTMLButtonElement}
 */
export function createSampleButton(input, placeholderText, onHeightAdjust = null) {
  const sampleButton = document.createElement('button');
  sampleButton.type = 'button';
  sampleButton.textContent = 'サンプルを入力';
  sampleButton.className = CSS_CLASSES.SAMPLE_INPUT_BTN;
  
  sampleButton.addEventListener('click', () => {
    // JSONとして整形して入力
    let formattedText = placeholderText;
    try {
      const parsed = JSON.parse(placeholderText);
      formattedText = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // JSONとしてパースできない場合は元のテキストをそのまま使用
      formattedText = placeholderText;
    }
    input.value = formattedText;
    
    // 高さ調整
    if (onHeightAdjust) {
      onHeightAdjust();
    } else if (input.adjustHeight) {
      input.adjustHeight();
    } else {
      // フォールバック: 直接高さを調整
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    }
    
    input.focus();
  });
  
  return sampleButton;
}

/**
 * 初期メッセージを表示
 * @param {string} historyListId - 履歴リストのDOM要素ID
 * @param {string} message - 表示するメッセージ
 */
export function showSelectMessage(historyListId, message = 'APIを選択してください。') {
  const historyList = document.getElementById(historyListId);
  if (!historyList) return;
  
  const existingMessage = historyList.querySelector('.api-select-message');
  if (!existingMessage) {
    const messageElement = document.createElement('p');
    messageElement.className = 'api-select-message'; // CSSクラスでスタイル適用
    messageElement.textContent = message;
    historyList.replaceChildren();
    historyList.appendChild(messageElement);
  }
}

/**
 * 初期メッセージを非表示
 * @param {string} historyListId - 履歴リストのDOM要素ID
 */
export function hideSelectMessage(historyListId) {
  const historyList = document.getElementById(historyListId);
  if (!historyList) return;
  
  const message = historyList.querySelector('.api-select-message');
  if (message) {
    message.remove();
  }
}

/**
 * ラベルとサンプルボタンを含むコンテナを作成
 * @param {HTMLElement} label - ラベル要素
 * @param {HTMLButtonElement|null} sampleButton - サンプルボタン（オプション）
 * @returns {HTMLDivElement}
 */
export function createLabelContainer(label, sampleButton = null) {
  const labelContainer = document.createElement('div');
  labelContainer.className = 'label-with-button';
  labelContainer.appendChild(label);
  if (sampleButton) {
    labelContainer.appendChild(sampleButton);
  }
  return labelContainer;
}

/**
 * テキストエリアの自動リサイズをセットアップ
 * @param {HTMLTextAreaElement} input - 入力要素
 * @param {number|Infinity} maxLines - 最大行数（デフォルト: 10、Infinityの場合は制限なし）
 */
export function setupAutoResize(input, maxLines = UI_CONFIG.TEXTAREA_MAX_LINES) {
  const lineHeight = parseInt(window.getComputedStyle(input).lineHeight) || 20;
  // JS API用（maxLines === Infinity）の場合は倍率を適用
  const minHeight = maxLines === Infinity 
    ? Math.round(lineHeight * UI_CONFIG.JS_ARG_INPUT_HEIGHT_MULTIPLIER) 
    : lineHeight;
  
  // 初期状態でスクロールバーを非表示にする（overflow-y: hidden）
  input.style.overflowY = 'hidden';
  
  // 初期高さを設定（既に設定されている場合は上書きしない）
  if (!input.style.height || input.style.height === 'auto') {
    input.style.height = minHeight + 'px';
  }
  
  const adjustHeight = () => {
    input.style.height = 'auto';
    const scrollHeight = input.scrollHeight;
    const scrollBuffer = UI_CONFIG.TEXTAREA_SCROLL_BUFFER;
    
    let newHeight;
    if (maxLines === Infinity) {
      // 制限なしの場合は、スクロール高さに合わせる（最小高さは倍率適用済み）
      // スクロールバーを防ぐためにバッファを追加
      newHeight = Math.max(scrollHeight + scrollBuffer, minHeight);
    } else {
      // 最大行数制限あり
      const maxHeight = lineHeight * maxLines;
      newHeight = Math.min(Math.max(scrollHeight + scrollBuffer, minHeight), maxHeight);
    }
    
    input.style.height = newHeight + 'px';
    
    // 高さがscrollHeightより大きい場合はoverflow-yをhiddenに、そうでない場合はautoに
    if (newHeight >= scrollHeight) {
      input.style.overflowY = 'hidden';
    } else {
      input.style.overflowY = 'auto';
    }
  };
  
  // 入力要素に関数を保存（サンプルボタンからもアクセス可能にする）
  input.adjustHeight = adjustHeight;
  
  // 初期値がある場合のみ高さを調整（プレースホルダーのみの場合は1行のまま）
  if (input.value) {
    setTimeout(adjustHeight, 0);
  }
  
  // 入力時に高さを自動調整
  input.addEventListener('input', adjustHeight);
  
  return adjustHeight;
}
