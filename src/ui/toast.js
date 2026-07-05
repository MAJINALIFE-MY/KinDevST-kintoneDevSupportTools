/**
 * KinDevST トースト通知モジュール
 * 画面下部に一時的な通知を表示する（成功/エラー/情報）
 * DOM構築はtextContentのみを使用（XSS対策）
 */

'use strict';

// 種別ごとの自動消滅時間（ミリ秒）
const AUTO_DISMISS_MS = {
  success: 2000,
  info: 3000,
  error: 5000
};

/**
 * トーストコンテナを取得（なければ生成）
 * @returns {HTMLElement}
 */
function getContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * トーストをフェードアウトして削除
 * @param {HTMLElement} toast
 */
function dismiss(toast) {
  if (!toast.isConnected) return;
  toast.classList.add('toast--closing');
  setTimeout(() => toast.remove(), 200);
}

/**
 * トーストを表示
 * @param {string} message - 表示メッセージ
 * @param {Object} [options]
 * @param {'success'|'error'|'info'} [options.type='info'] - 種別
 * @param {string|null} [options.actionLabel] - アクションボタンのラベル（例: 元に戻す）
 * @param {Function|null} [options.onAction] - アクションボタン押下時のコールバック
 * @param {number|null} [options.duration] - 自動消滅までのミリ秒（省略時は種別ごとの既定値）
 * @returns {HTMLElement} 生成したトースト要素
 */
export function showToast(message, { type = 'info', actionLabel = null, onAction = null, duration = null } = {}) {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);

  if (actionLabel && onAction) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      dismiss(toast);
      onAction();
    });
    toast.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '×';
  closeBtn.title = '閉じる';
  closeBtn.addEventListener('click', () => dismiss(toast));
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // アクション付きトーストは操作の猶予を長めにとる
  const dismissAfter = duration ?? (actionLabel ? AUTO_DISMISS_MS.error : (AUTO_DISMISS_MS[type] ?? AUTO_DISMISS_MS.info));
  setTimeout(() => dismiss(toast), dismissAfter);

  return toast;
}
