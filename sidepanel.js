/**
 * KinDevST - kintone Developer Support Tool
 * サイドパネルのメインエントリーポイント
 */

'use strict';

// API定義・実行クラス
import { JSAPIDefinitionManager } from './js-api/js-api-definitions.js';
import { JSAPIExecutor } from './js-api/js-api-executor.js';
import { RESTAPIDefinitionManager } from './rest-api/rest-api-definitions.js';
import { RESTAPIExecutor } from './rest-api/rest-api-executor.js';

// ユーティリティモジュール
import { 
  API_TYPES, 
  REST_DOM_IDS, 
  JS_DOM_IDS, 
  CONFIG_DOM_IDS,
  HISTORY_CONFIG,
  TIMING,
  KINTONE_DOMAIN_PATTERN,
  ERROR_MESSAGES,
  CSS_CLASSES,
  STORAGE_KEYS,
  AUTH_TYPES
} from './utils/constants.js';
import { ConfigManager } from './utils/config-manager.js';
import { HistoryManager } from './utils/history-manager.js';

// UIモジュール
import { ApiSelector, waitForJQuery } from './ui/api-selector.js';
import { TabManager, AuthSectionManager } from './ui/tab-manager.js';
import { RestApiDisplay, JsApiDisplay } from './ui/api-display.js';

// API実行ハンドラー
import { RestApiHandler } from './api/rest-api-handler.js';
import { JsApiHandler } from './api/js-api-handler.js';

// ===== グローバルインスタンス =====

// マネージャーと実行クラス
const jsApiDefinitionManager = new JSAPIDefinitionManager();
const jsApiExecutor = new JSAPIExecutor(jsApiDefinitionManager);
const restApiDefinitionManager = new RESTAPIDefinitionManager();
const restApiExecutor = new RESTAPIExecutor(restApiDefinitionManager);

// UIコンポーネント
let tabManager;
let authSectionManager;
let restApiSelector;
let jsApiSelector;
let restApiDisplay;
let jsApiDisplay;
let restApiHandler;
let jsApiHandler;

// ===== 初期化 =====

document.addEventListener('DOMContentLoaded', async () => {
  // タブ管理の初期化
  tabManager = new TabManager({
    onTabChange: async (tabId) => {
      // タブ切り替え時に履歴を表示（履歴がない場合は初期メッセージが表示される）
      if (tabId === API_TYPES.REST) {
        const restHistory = await HistoryManager.getByType(API_TYPES.REST);
        if (restHistory.length > 0 && restApiHandler && jsApiHandler) {
          await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
        }
      } else if (tabId === API_TYPES.JS) {
        const jsHistory = await HistoryManager.getByType(API_TYPES.JS);
        if (jsHistory.length > 0 && restApiHandler && jsApiHandler) {
          await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
        }
      }
    }
  });
  tabManager.setupTabs();
  
  // 認証セクション管理の初期化
  authSectionManager = new AuthSectionManager(CONFIG_DOM_IDS.AUTH_TYPE);
  authSectionManager.setup();
  
  // jQueryの読み込みを待つ
  await waitForJQuery();
  
  // JSON定義の読み込み
  await jsApiDefinitionManager.loadDefinitions('./js-api/js-api-definitions.json');
  await restApiDefinitionManager.loadDefinitions('./rest-api/rest-api-definitions.json');
  
  // REST API表示管理の初期化
  restApiDisplay = new RestApiDisplay({
    definitionManager: restApiDefinitionManager,
    docLinkId: REST_DOM_IDS.DOC_LINK,
    infoDisplayId: REST_DOM_IDS.INFO_DISPLAY,
    bodyInputId: REST_DOM_IDS.BODY,
    historyListId: REST_DOM_IDS.HISTORY_LIST
  });
  
  // JS API表示管理の初期化
  jsApiDisplay = new JsApiDisplay({
    definitionManager: jsApiDefinitionManager,
    docLinkId: JS_DOM_IDS.DOC_LINK,
    argsContainerId: JS_DOM_IDS.ARGS_CONTAINER,
    historyListId: JS_DOM_IDS.HISTORY_LIST
  });
  
  // REST APIセレクターの初期化
  restApiSelector = new ApiSelector({
    displaySelectorId: REST_DOM_IDS.SELECTOR_DISPLAY,
    nameSelectorId: REST_DOM_IDS.SELECTOR_NAME,
    definitionManager: restApiDefinitionManager,
    onSelect: (apiName) => restApiDisplay.update(apiName),
    includeCustomOption: false,
    showDuplicateFlag: false
  });
  restApiSelector.initialize();
  
  // JS APIセレクターの初期化
  jsApiSelector = new ApiSelector({
    displaySelectorId: JS_DOM_IDS.SELECTOR_DISPLAY,
    nameSelectorId: JS_DOM_IDS.SELECTOR_NAME,
    definitionManager: jsApiDefinitionManager,
    onSelect: (apiName) => jsApiDisplay.update(apiName),
    showDuplicateFlag: true
  });
  jsApiSelector.initialize();
  
  // REST API実行ハンドラーの初期化
  restApiHandler = new RestApiHandler({
    definitionManager: restApiDefinitionManager,
    executor: restApiExecutor,
    selector: restApiSelector
  });
  restApiHandler.setupExecuteButton();
  
  // JS API実行ハンドラーの初期化
  jsApiHandler = new JsApiHandler({
    definitionManager: jsApiDefinitionManager,
    executor: jsApiExecutor,
    selector: jsApiSelector
  });
  jsApiHandler.setupExecuteButton();
  
  // コピーボタンのセットアップ（実行結果表示エリアを削除したため、コピーボタンも不要）
  
  // 設定保存ボタンのセットアップ
  setupConfigSaveButtons();
  
  // タブ記憶機能のセットアップ
  setupTabMemory();
  setupTabInfoAutoUpdate();
  await displayTabInfo();
  
  // 初期表示時の認証セクション更新
  const initialAuthType = document.getElementById(CONFIG_DOM_IDS.AUTH_TYPE)?.value;
  if (initialAuthType) {
    authSectionManager.updateSection(initialAuthType);
  }
  
  // 設定の読み込み
  await loadConfig();
  
  // OAuthリダイレクトURIを表示
  const redirectInput = document.getElementById(CONFIG_DOM_IDS.OAUTH_REDIRECT_URI);
  if (redirectInput) {
    redirectInput.value = ConfigManager.getOAuthRedirectUri();
  }
  
  // 履歴を初期表示（履歴がない場合は初期メッセージが表示される）
  const restHistory = await HistoryManager.getByType(API_TYPES.REST);
  const jsHistory = await HistoryManager.getByType(API_TYPES.JS);

      if (restHistory.length > 0) {
        await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
      }
      
      if (jsHistory.length > 0) {
        await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
      }
  
  // オートロック通知の受信処理
  setupAutoLockListener();
});

// ===== 設定管理 =====

/**
 * 設定を読み込み、UIに反映
 */
async function loadConfig() {
  const config = await ConfigManager.loadAllConfig();
  
  // 認証方式の復元
  authSectionManager.setAuthType(config.authType);
  
  // パスワード認証設定
  const authUserInput = document.getElementById(CONFIG_DOM_IDS.AUTH_USER);
  const authPassInput = document.getElementById(CONFIG_DOM_IDS.AUTH_PASS);
  if (authUserInput) authUserInput.value = config.authUser;
  if (authPassInput) authPassInput.value = config.authPass;
  
  // APIトークン設定
  const authApiTokenInput = document.getElementById(CONFIG_DOM_IDS.AUTH_API_TOKEN);
  if (authApiTokenInput) authApiTokenInput.value = config.authApiToken;
  
  // OAuth設定
  const oauthClientIdInput = document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_ID);
  const oauthClientSecretInput = document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_SECRET);
  if (oauthClientIdInput) oauthClientIdInput.value = config.oauthClientId;
  if (oauthClientSecretInput) oauthClientSecretInput.value = config.oauthClientSecret;
  
  // 履歴保存数の設定
  const historyLimitInput = document.getElementById(CONFIG_DOM_IDS.HISTORY_LIMIT);
  if (historyLimitInput) {
    historyLimitInput.value = config.historyLimit;
  }
  
  // REST API表示設定
  const showRequestHeadersInput = document.getElementById(CONFIG_DOM_IDS.SHOW_REQUEST_HEADERS);
  const showStatusCodeInput = document.getElementById(CONFIG_DOM_IDS.SHOW_STATUS_CODE);
  const showResponseHeadersInput = document.getElementById(CONFIG_DOM_IDS.SHOW_RESPONSE_HEADERS);
  if (showRequestHeadersInput) showRequestHeadersInput.checked = config.showRequestHeaders;
  if (showStatusCodeInput) showStatusCodeInput.checked = config.showStatusCode;
  if (showResponseHeadersInput) showResponseHeadersInput.checked = config.showResponseHeaders;
  
  // ボタン表示設定
  const showCopyButtonInput = document.getElementById(CONFIG_DOM_IDS.SHOW_COPY_BUTTON);
  const showRerunButtonInput = document.getElementById(CONFIG_DOM_IDS.SHOW_RERUN_BUTTON);
  const showDeleteButtonInput = document.getElementById(CONFIG_DOM_IDS.SHOW_DELETE_BUTTON);
  if (showCopyButtonInput) showCopyButtonInput.checked = config.showCopyButton;
  if (showRerunButtonInput) showRerunButtonInput.checked = config.showRerunButton;
  if (showDeleteButtonInput) showDeleteButtonInput.checked = config.showDeleteButton;
  
  // 実行ログ設定
  const showExecutionLogInput = document.getElementById(CONFIG_DOM_IDS.SHOW_EXECUTION_LOG);
  if (showExecutionLogInput) showExecutionLogInput.checked = config.showExecutionLog;
}

/**
 * 設定保存ボタンをセットアップ
 */
function setupConfigSaveButtons() {
  // 設定保存ボタン（認証設定 + 表示設定 + 履歴設定）
  const saveConfigBtn = document.getElementById(CONFIG_DOM_IDS.SAVE_CONFIG_BTN);
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', async () => {
      // 認証設定
      const authConfig = {
        authType: document.getElementById(CONFIG_DOM_IDS.AUTH_TYPE)?.value,
        authUser: document.getElementById(CONFIG_DOM_IDS.AUTH_USER)?.value,
        authPass: document.getElementById(CONFIG_DOM_IDS.AUTH_PASS)?.value,
        authApiToken: document.getElementById(CONFIG_DOM_IDS.AUTH_API_TOKEN)?.value,
        oauthClientId: document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_ID)?.value,
        oauthClientSecret: document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_SECRET)?.value
      };
      
      // 表示設定
      const displayConfig = {
        showRequestHeaders: document.getElementById(CONFIG_DOM_IDS.SHOW_REQUEST_HEADERS)?.checked ?? true,
        showStatusCode: document.getElementById(CONFIG_DOM_IDS.SHOW_STATUS_CODE)?.checked ?? true,
        showResponseHeaders: document.getElementById(CONFIG_DOM_IDS.SHOW_RESPONSE_HEADERS)?.checked ?? true
      };
      
      // ボタン表示設定
      const buttonDisplayConfig = {
        showCopyButton: document.getElementById(CONFIG_DOM_IDS.SHOW_COPY_BUTTON)?.checked ?? true,
        showRerunButton: document.getElementById(CONFIG_DOM_IDS.SHOW_RERUN_BUTTON)?.checked ?? true,
        showDeleteButton: document.getElementById(CONFIG_DOM_IDS.SHOW_DELETE_BUTTON)?.checked ?? true
      };
      
      // 実行ログ設定
      const showExecutionLog = document.getElementById(CONFIG_DOM_IDS.SHOW_EXECUTION_LOG)?.checked ?? false;
      
      // 履歴設定
      const historyLimitInput = document.getElementById(CONFIG_DOM_IDS.HISTORY_LIMIT);
      const historyLimit = parseInt(historyLimitInput?.value) || HISTORY_CONFIG.DEFAULT_LIMIT;
      
      await ConfigManager.saveAuthConfig(authConfig);
      await ConfigManager.saveRestApiDisplayConfig(displayConfig);
      await ConfigManager.saveButtonDisplayConfig(buttonDisplayConfig);
      await ConfigManager.saveExecutionLogEnabled(showExecutionLog);
      await ConfigManager.setHistoryLimit(historyLimit);
      await HistoryManager.trimToLimit();
      
      // 履歴を再表示して設定を反映
      await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
      await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST, null, { rest: restApiHandler, js: jsApiHandler });
      
      showSaveMessage(CONFIG_DOM_IDS.CONFIG_MESSAGE);
    });
  }
}

/**
 * 保存完了メッセージを表示
 * @param {string} messageElementId - メッセージ要素のID
 */
function showSaveMessage(messageElementId) {
  const message = document.getElementById(messageElementId);
  if (message) {
    message.style.display = 'block';
    setTimeout(() => {
      message.style.display = 'none';
    }, TIMING.SAVE_MESSAGE_DISPLAY);
  }
}

/**
 * エラーメッセージを表示
 * @param {string} messageElementId - メッセージ要素のID
 * @param {string} errorMessage - エラーメッセージ
 */
function showErrorMessage(messageElementId, errorMessage) {
  const message = document.getElementById(messageElementId);
  if (message) {
    message.textContent = errorMessage;
    message.style.display = 'block';
    message.style.color = '#d32f2f';
    setTimeout(() => {
      message.style.display = 'none';
      message.style.color = '';
    }, TIMING.SAVE_MESSAGE_DISPLAY);
  }
}

// ===== オートロック機能 =====

/**
 * オートロック通知のリスナーをセットアップ
 */
function setupAutoLockListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EVENT_LOGOUT') {
      handleAutoLock();
    }
  });
}

/**
 * オートロック処理
 */
async function handleAutoLock() {
  // 認証情報入力欄をクリア
  const authUserInput = document.getElementById(CONFIG_DOM_IDS.AUTH_USER);
  const authPassInput = document.getElementById(CONFIG_DOM_IDS.AUTH_PASS);
  const authApiTokenInput = document.getElementById(CONFIG_DOM_IDS.AUTH_API_TOKEN);
  const oauthClientIdInput = document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_ID);
  const oauthClientSecretInput = document.getElementById(CONFIG_DOM_IDS.OAUTH_CLIENT_SECRET);
  
  if (authUserInput) authUserInput.value = '';
  if (authPassInput) authPassInput.value = '';
  if (authApiTokenInput) authApiTokenInput.value = '';
  if (oauthClientIdInput) oauthClientIdInput.value = '';
  if (oauthClientSecretInput) oauthClientSecretInput.value = '';
  
  // 認証方式をセッション認証にリセット
  const authTypeSelect = document.getElementById(CONFIG_DOM_IDS.AUTH_TYPE);
  if (authTypeSelect) {
    authTypeSelect.value = AUTH_TYPES.SESSION;
    if (authSectionManager) {
      authSectionManager.updateSection(AUTH_TYPES.SESSION);
    }
  }
  
  // ユーザーに通知
  showErrorMessage(CONFIG_DOM_IDS.CONFIG_MESSAGE, '一定時間操作がなかったため、セキュリティ保護のためログアウトしました。');
}

// ===== タブ記憶機能 =====

/**
 * タブ記憶機能をセットアップ
 */
function setupTabMemory() {
  const saveTabBtn = document.getElementById(CONFIG_DOM_IDS.SAVE_TAB_BTN);
  if (!saveTabBtn) return;
  
  saveTabBtn.addEventListener('click', async () => {
    try {
      // 現在アクティブなタブを取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showErrorMessage(CONFIG_DOM_IDS.TAB_MESSAGE, ERROR_MESSAGES.NO_ACTIVE_TAB);
        return;
      }
      
      // cybozu.comかチェック
      if (!tab.url.includes(KINTONE_DOMAIN_PATTERN)) {
        showErrorMessage(CONFIG_DOM_IDS.TAB_MESSAGE, ERROR_MESSAGES.NOT_KINTONE_TAB);
        return;
      }
      
      // タブ情報を保存
      const tabInfo = {
        title: tab.title || '',
        url: tab.url || ''
      };
      await ConfigManager.saveKintoneTab(tab.id, tabInfo);
      
      // 表示を更新
      await displayTabInfo();
      
      // 成功メッセージを表示
      showSaveMessage(CONFIG_DOM_IDS.TAB_MESSAGE);
    } catch (e) {
      showErrorMessage(CONFIG_DOM_IDS.TAB_MESSAGE, e.message);
    }
  });
}

/**
 * 記憶中のタブ情報を表示
 */
async function displayTabInfo() {
  const tabInfoDisplay = document.getElementById(CONFIG_DOM_IDS.TAB_INFO_DISPLAY);
  if (!tabInfoDisplay) return;
  
  const tabId = await ConfigManager.getKintoneTabId();
  const tabInfo = await ConfigManager.getKintoneTabInfo();
  
  if (!tabId || !tabInfo) {
    tabInfoDisplay.classList.remove('active');
    tabInfoDisplay.classList.add(CSS_CLASSES.HIDDEN);
    return;
  }
  
  // タブが存在するか確認
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab) {
      // タブ情報を表示
      const titleElement = tabInfoDisplay.querySelector('.tab-info-title');
      const urlElement = tabInfoDisplay.querySelector('.tab-info-url');
      
      if (titleElement) {
        titleElement.textContent = tabInfo.title || 'タイトルなし';
        titleElement.style.fontWeight = 'bold';
        titleElement.style.marginBottom = '5px';
      }
      if (urlElement) {
        urlElement.textContent = tabInfo.url || 'URLなし';
        urlElement.style.wordBreak = 'break-all';
        urlElement.style.fontSize = '0.9em';
        urlElement.style.color = '#666';
      }
      
      tabInfoDisplay.classList.add('active');
      tabInfoDisplay.classList.remove(CSS_CLASSES.HIDDEN);
    } else {
      tabInfoDisplay.classList.remove('active');
      tabInfoDisplay.classList.add(CSS_CLASSES.HIDDEN);
    }
  } catch (e) {
    // タブが存在しない場合は非表示
    tabInfoDisplay.classList.remove('active');
    tabInfoDisplay.classList.add(CSS_CLASSES.HIDDEN);
  }
}

/**
 * タブ情報の自動更新をセットアップ
 */
function setupTabInfoAutoUpdate() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    
    // KINTONE_TAB_IDまたはKINTONE_TAB_INFOが変更された場合
    if (changes[STORAGE_KEYS.KINTONE_TAB_ID] || changes[STORAGE_KEYS.KINTONE_TAB_INFO]) {
      displayTabInfo();
    }
  });
  
  // 削除ボタンのセットアップ
  const clearTabBtn = document.getElementById('clear-tab-btn');
  if (clearTabBtn) {
    clearTabBtn.addEventListener('click', async () => {
      await ConfigManager.clearKintoneTab();
      await displayTabInfo();
      showSaveMessage(CONFIG_DOM_IDS.TAB_MESSAGE);
    });
  }
}
