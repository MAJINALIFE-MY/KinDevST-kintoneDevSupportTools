/**
 * KinDevST 定数管理モジュール
 * アプリケーション全体で使用する定数を一元管理
 */

'use strict';

// ストレージキー
export const STORAGE_KEYS = {
  HISTORY: 'api_execution_history',
  HISTORY_LIMIT: 'history_limit',
  AUTH_TYPE: 'authType',
  AUTH_USER: 'authUser',
  AUTH_PASS: 'authPass',
  AUTH_API_TOKEN: 'authApiToken',
  OAUTH_CLIENT_ID: 'oauthClientId',
  OAUTH_CLIENT_SECRET: 'oauthClientSecret',
  SHOW_REQUEST_HEADERS: 'showRequestHeaders',
  SHOW_STATUS_CODE: 'showStatusCode',
  SHOW_RESPONSE_HEADERS: 'showResponseHeaders',
  SHOW_COPY_BUTTON: 'showCopyButton',
  SHOW_RERUN_BUTTON: 'showRerunButton',
  SHOW_DELETE_BUTTON: 'showDeleteButton',
  SHOW_EXECUTION_LOG: 'showExecutionLog',
  KINTONE_TAB_ID: 'kintoneTabId',
  KINTONE_TAB_INFO: 'kintoneTabInfo'
};

// 履歴設定
export const HISTORY_CONFIG = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 30,
  MIN_LIMIT: 1
};

// API種別
export const API_TYPES = {
  REST: 'rest',
  JS: 'js'
};

// 認証方式
export const AUTH_TYPES = {
  PASSWORD: 'password',
  TOKEN: 'token',
  OAUTH: 'oauth',
  SESSION: 'session'
};

// kintoneドメインパターン
export const KINTONE_DOMAIN_PATTERN = '.cybozu.com';

// メッセージタイプ（バックグラウンドとの通信用）
export const MESSAGE_TYPES = {
  REST_API_EXECUTE: 'REST_API_EXECUTE'
};

// DOM要素ID（REST API用）
export const REST_DOM_IDS = {
  SELECTOR_DISPLAY: 'rest-api-selector-display',
  SELECTOR_NAME: 'rest-api-selector-name',
  DOC_LINK: 'rest-api-doc-link',
  INFO_DISPLAY: 'rest-api-info-display',
  BODY: 'rest-body',
  EXEC_BTN: 'rest-exec-btn',
  HISTORY_LIST: 'rest-history-list'
};

// DOM要素ID（JS API用）
export const JS_DOM_IDS = {
  SELECTOR_DISPLAY: 'js-api-selector-display',
  SELECTOR_NAME: 'js-api-selector-name',
  DOC_LINK: 'js-api-doc-link',
  ARGS_CONTAINER: 'js-args-container',
  EXEC_BTN: 'js-exec-btn',
  HISTORY_LIST: 'js-history-list'
};

// DOM要素ID（設定画面用）
export const CONFIG_DOM_IDS = {
  AUTH_TYPE: 'auth-type',
  AUTH_USER: 'auth-user',
  AUTH_PASS: 'auth-pass',
  AUTH_API_TOKEN: 'auth-api-token',
  OAUTH_CLIENT_ID: 'oauth-client-id',
  OAUTH_CLIENT_SECRET: 'oauth-client-secret',
  OAUTH_REDIRECT_URI: 'oauth-redirect-uri',
  HISTORY_LIMIT: 'history-limit',
  SHOW_REQUEST_HEADERS: 'show-request-headers',
  SHOW_STATUS_CODE: 'show-status-code',
  SHOW_RESPONSE_HEADERS: 'show-response-headers',
  SHOW_COPY_BUTTON: 'show-copy-button',
  SHOW_RERUN_BUTTON: 'show-rerun-button',
  SHOW_DELETE_BUTTON: 'show-delete-button',
  SHOW_EXECUTION_LOG: 'show-execution-log',
  SAVE_CONFIG_BTN: 'save-config-btn',
  SAVE_HISTORY_CONFIG_BTN: 'save-history-config-btn',
  CONFIG_MESSAGE: 'config-message',
  HISTORY_CONFIG_MESSAGE: 'history-config-message',
  SAVE_TAB_BTN: 'save-tab-btn',
  TAB_MESSAGE: 'tab-message',
  TAB_INFO_DISPLAY: 'tab-info-display'
};

// Select2のオプション
export const SELECT2_OPTIONS = {
  DISPLAY: {
    placeholder: '表示名で検索',
    allowClear: true,
    width: '100%'
  },
  NAME: {
    placeholder: 'API名で検索',
    allowClear: true,
    width: '100%'
  }
};

// CSSクラス
export const CSS_CLASSES = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  HISTORY_ITEM: 'history-item',
  HISTORY_BUTTONS: 'history-buttons',
  HISTORY_RERUN_BTN: 'history-rerun-btn',
  HISTORY_COPY_BTN: 'history-copy-btn',
  HISTORY_DELETE_BTN: 'history-delete-btn',
  FORM_GROUP: 'form-group',
  JS_ARG_INPUT: 'js-arg-input',
  SAMPLE_INPUT_BTN: 'sample-input-btn'
};

// タイミング設定（ミリ秒）
export const TIMING = {
  JQUERY_WAIT_TIMEOUT: 5000,           // jQuery読み込み待機タイムアウト
  JQUERY_WAIT_INTERVAL: 50,            // jQuery読み込みチェック間隔
  CONTENT_SCRIPT_INJECT_WAIT: 100,     // Content Script注入後の待機時間
  SAVE_MESSAGE_DISPLAY: 2000,          // 保存完了メッセージ表示時間
  BUTTON_FEEDBACK_DISPLAY: 1500        // ボタンフィードバック表示時間
};

// UI設定
export const UI_CONFIG = {
  TEXTAREA_MAX_LINES: 10,              // テキストエリア最大行数
  JS_ARG_INPUT_HEIGHT_MULTIPLIER: 1.5, // JS API引数入力欄の高さ倍率（行高さに対する倍率）
  TEXTAREA_SCROLL_BUFFER: 2            // テキストエリアのスクロールバー防止用バッファ（px）
};

// エラーメッセージ
export const ERROR_MESSAGES = {
  NO_ACTIVE_TAB: 'アクティブなタブが見つかりません',
  NOT_KINTONE_PAGE: 'kintoneのページが開かれていません',
  NOT_KINTONE_PAGE_DETAIL: 'kintoneのページが開かれていません (URLに.cybozu.comが含まれていません)',
  CONTENT_SCRIPT_INJECTION_FAILED: 'Content Scriptの注入に失敗しました',
  UNEXPECTED_RESPONSE: '予期しないレスポンス形式',
  API_DEFINITION_NOT_FOUND: 'API定義が見つかりません',
  KINTONE_OBJECT_NOT_FOUND: 'kintoneオブジェクトが見つかりません。kintoneのページを開いているか確認してください。',
  API_FUNCTION_NOT_FOUND: 'API関数が見つかりません',
  EXECUTION_RESULT_EMPTY: '実行結果が返されませんでした',
  JSON_PARSE_ERROR: 'リクエストボディのJSONパースエラー',
  // 認証関連
  AUTH_PASSWORD_REQUIRED: 'パスワード認証にはログイン名とパスワードが必要です',
  AUTH_TOKEN_REQUIRED: 'APIトークンが設定されていません',
  AUTH_OAUTH_TOKEN_REQUIRED: 'OAuthアクセストークンが設定されていません',
  AUTH_SESSION_VIA_CONTENT_SCRIPT: 'セッション認証はContent Script経由で実行する必要があります',
  AUTH_UNKNOWN_TYPE: '不明な認証方式',
  // タブ関連
  KINTONE_TAB_NOT_FOUND: '記憶されたkintoneタブが見つかりません。タブが閉じられた可能性があります。Settingタブで再度タブを記憶してください。',
  NOT_KINTONE_TAB: '現在開いているタブはkintoneのページではありません。',
  // CSRFトークン関連
  CSRF_TOKEN_FETCH_FAILED: 'CSRFトークンの取得に失敗しました',
  CSRF_TOKEN_EMPTY: 'CSRFトークンが空です'
};
