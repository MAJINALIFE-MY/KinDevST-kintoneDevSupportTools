/**
 * KinDevST - kintone Developer Support Tool
 * サイドパネルのメインエントリーポイント
 */

'use strict';

// API定義・実行クラス
import { JSAPIDefinitionManager } from './js-api/js-api-definitions.js';
import { matchesScreenFilter } from './js-api/js-api-availability.js';
import { JSAPIExecutor } from './js-api/js-api-executor.js';
import { RESTAPIDefinitionManager } from './rest-api/rest-api-definitions.js';
import { UserAPIDefinitionManager } from './user-api/user-api-definitions.js';
import { RestLikeExecutor } from './utils/rest-like-executor.js';

// ユーティリティモジュール
import {
  API_TYPES,
  REST_DOM_IDS,
  JS_DOM_IDS,
  USER_DOM_IDS,
  CONFIG_DOM_IDS,
  HISTORY_CONFIG,
  TIMING,
  ERROR_MESSAGES,
  CSS_CLASSES,
  STORAGE_KEYS
} from './utils/constants.js';
import { isKintoneUrl } from './utils/domain-validator.js';
import { ConfigManager } from './utils/config-manager.js';
import { HistoryManager } from './utils/history-manager.js';

// UIモジュール
import { ApiSelector, waitForJQuery } from './ui/api-selector.js';
import { TabManager, AuthSectionManager } from './ui/tab-manager.js';
import { RestApiDisplay, JsApiDisplay } from './ui/api-display.js';
import { showEmptyState } from './ui/ui-helpers.js';
import { showToast } from './ui/toast.js';

// API実行ハンドラー
import { BodyApiHandler } from './api/body-api-handler.js';
import { JsApiHandler } from './api/js-api-handler.js';

// ===== グローバルインスタンス =====

// マネージャーと実行クラス
const jsApiDefinitionManager = new JSAPIDefinitionManager();
const jsApiExecutor = new JSAPIExecutor(jsApiDefinitionManager);
const restApiDefinitionManager = new RESTAPIDefinitionManager();
const restApiExecutor = new RestLikeExecutor(restApiDefinitionManager);
const userApiDefinitionManager = new UserAPIDefinitionManager();
const userApiExecutor = new RestLikeExecutor(userApiDefinitionManager);

// UIコンポーネント
let tabManager;
let authSectionManager;
let restApiSelector;
let jsApiSelector;
let userApiSelector;
let restApiDisplay;
let jsApiDisplay;
let userApiDisplay;
let restApiHandler;
let jsApiHandler;
let userApiHandler;

// ===== 初期化 =====

document.addEventListener('DOMContentLoaded', async () => {
  // タブ管理の初期化
  tabManager = new TabManager({
    onTabChange: async (tabId) => {
      // タブ切り替え時に履歴を表示（履歴がない場合は初期メッセージが表示される）
      if (tabId === API_TYPES.REST) {
        const restHistory = await HistoryManager.getByType(API_TYPES.REST);
        if (restHistory.length > 0 && restApiHandler && jsApiHandler) {
          await HistoryManager.display(API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST);
        }
      } else if (tabId === API_TYPES.JS) {
        const jsHistory = await HistoryManager.getByType(API_TYPES.JS);
        if (jsHistory.length > 0 && restApiHandler && jsApiHandler) {
          await HistoryManager.display(API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST);
        }
      } else if (tabId === API_TYPES.USER) {
        const userHistory = await HistoryManager.getByType(API_TYPES.USER);
        if (userHistory.length > 0 && userApiHandler) {
          await HistoryManager.display(API_TYPES.USER, USER_DOM_IDS.HISTORY_LIST);
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
  await userApiDefinitionManager.loadDefinitions('./user-api/user-api-definitions.json');

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
    showDuplicateFlag: true,
    filterFn: (apiName) => {
      const platform = document.querySelector(`input[name="${JS_DOM_IDS.FILTER_PLATFORM_NAME}"]:checked`)?.value || 'all';
      const screen = document.getElementById(JS_DOM_IDS.FILTER_SCREEN)?.value || '';
      const definition = jsApiDefinitionManager.getDefinition(apiName);
      return matchesScreenFilter(definition, { platform, screen });
    }
  });
  jsApiSelector.initialize();
  setupJsApiFilter();

  // User API表示管理の初期化
  userApiDisplay = new RestApiDisplay({
    definitionManager: userApiDefinitionManager,
    docLinkId: USER_DOM_IDS.DOC_LINK,
    infoDisplayId: USER_DOM_IDS.INFO_DISPLAY,
    bodyInputId: USER_DOM_IDS.BODY,
    historyListId: USER_DOM_IDS.HISTORY_LIST
  });

  // User APIセレクターの初期化
  userApiSelector = new ApiSelector({
    displaySelectorId: USER_DOM_IDS.SELECTOR_DISPLAY,
    nameSelectorId: USER_DOM_IDS.SELECTOR_NAME,
    definitionManager: userApiDefinitionManager,
    onSelect: (apiName) => userApiDisplay.update(apiName),
    includeCustomOption: false,
    showDuplicateFlag: false
  });
  userApiSelector.initialize();

  // REST API実行ハンドラーの初期化
  restApiHandler = new BodyApiHandler({
    definitionManager: restApiDefinitionManager,
    executor: restApiExecutor,
    selector: restApiSelector,
    domIds: REST_DOM_IDS,
    apiType: API_TYPES.REST
  });
  restApiHandler.setupExecuteButton();

  // JS API実行ハンドラーの初期化
  jsApiHandler = new JsApiHandler({
    definitionManager: jsApiDefinitionManager,
    executor: jsApiExecutor,
    selector: jsApiSelector
  });
  jsApiHandler.setupExecuteButton();

  // User API実行ハンドラーの初期化
  userApiHandler = new BodyApiHandler({
    definitionManager: userApiDefinitionManager,
    executor: userApiExecutor,
    selector: userApiSelector,
    domIds: USER_DOM_IDS,
    apiType: API_TYPES.USER
  });
  userApiHandler.setupExecuteButton();

  // 再実行用ハンドラー束を一度だけ登録（以降の display は handlers 省略可）
  HistoryManager.setHandlers({ rest: restApiHandler, js: jsApiHandler, user: userApiHandler });

  // 設定の自動保存のセットアップ
  setupConfigAutoSave();

  // API名コピーボタンのセットアップ
  setupApiNameCopyButtons();

  // タブ記憶機能のセットアップ
  setupTabMemory();
  setupTabInfoAutoUpdate();
  await displayTabInfo();

  // 「Settingを開く」等のタブ遷移リンクのセットアップ
  setupTabNavigationLinks();

  // 実行先未設定バナーのセットアップ
  setupExecutionTargetBanner();

  // 初期表示時の認証セクション更新
  const initialAuthType = document.getElementById(CONFIG_DOM_IDS.AUTH_TYPE)?.value;
  if (initialAuthType) {
    authSectionManager.updateSection(initialAuthType);
  }

  // 設定の読み込み
  await loadConfig();

  // 履歴を初期表示（履歴がない場合は初回ガイドを表示）
  const initialTargets = [
    [API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST],
    [API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST],
    [API_TYPES.USER, USER_DOM_IDS.HISTORY_LIST]
  ];
  for (const [type, historyListId] of initialTargets) {
    const history = await HistoryManager.getByType(type);
    if (history.length > 0) {
      await HistoryManager.display(type, historyListId);
    } else {
      showEmptyState(historyListId);
    }
  }
});

// ===== 設定管理 =====

/**
 * 設定を読み込み、UIに反映
 */
async function loadConfig() {
  const config = await ConfigManager.loadAllConfig();

  // 認証方式の復元（認証情報は永続化しないため、方式のみデフォルト＝セッションに戻す）
  authSectionManager.setAuthType(config.authType);

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

  // API名コピー形式設定
  const copyIncludeDisplayNameInput = document.getElementById(CONFIG_DOM_IDS.COPY_INCLUDE_DISPLAY_NAME);
  const copyIncludeApiNameInput = document.getElementById(CONFIG_DOM_IDS.COPY_INCLUDE_API_NAME);
  const copyIncludeUrlInput = document.getElementById(CONFIG_DOM_IDS.COPY_INCLUDE_URL);
  if (copyIncludeDisplayNameInput) copyIncludeDisplayNameInput.checked = config.copyIncludeDisplayName !== false;
  if (copyIncludeApiNameInput) copyIncludeApiNameInput.checked = config.copyIncludeApiName !== false;
  if (copyIncludeUrlInput) copyIncludeUrlInput.checked = config.copyIncludeUrl !== false;
}

/**
 * 履歴がある種別のみ履歴表示を更新する
 * （履歴ゼロの種別は初回ガイド/初期メッセージを維持するため再描画しない）
 */
async function refreshHistories() {
  const targets = [
    [API_TYPES.REST, REST_DOM_IDS.HISTORY_LIST],
    [API_TYPES.JS, JS_DOM_IDS.HISTORY_LIST],
    [API_TYPES.USER, USER_DOM_IDS.HISTORY_LIST]
  ];
  for (const [type, historyListId] of targets) {
    const history = await HistoryManager.getByType(type);
    if (history.length > 0) {
      await HistoryManager.display(type, historyListId);
    }
  }
}

/**
 * 設定の自動保存をセットアップ
 * 保存ボタンは廃止し、各設定の変更時に即時保存する（押し忘れ事故の防止）。
 * 認証情報（パスワード / APIトークン等）は従来通り永続化しない。
 */
function setupConfigAutoSave() {
  const notifySaved = () => showToast('設定を保存しました', { type: 'success' });
  const addChangeListener = (id, handler) => document.getElementById(id)?.addEventListener('change', handler);
  const isChecked = (id, fallback = true) => document.getElementById(id)?.checked ?? fallback;

  // REST API表示設定（履歴表示に影響するため再描画する）
  const saveRestDisplayConfig = async () => {
    await ConfigManager.saveRestApiDisplayConfig({
      showRequestHeaders: isChecked(CONFIG_DOM_IDS.SHOW_REQUEST_HEADERS),
      showStatusCode: isChecked(CONFIG_DOM_IDS.SHOW_STATUS_CODE),
      showResponseHeaders: isChecked(CONFIG_DOM_IDS.SHOW_RESPONSE_HEADERS)
    });
    await refreshHistories();
    notifySaved();
  };
  [
    CONFIG_DOM_IDS.SHOW_REQUEST_HEADERS,
    CONFIG_DOM_IDS.SHOW_STATUS_CODE,
    CONFIG_DOM_IDS.SHOW_RESPONSE_HEADERS
  ].forEach((id) => addChangeListener(id, saveRestDisplayConfig));

  // ボタン表示設定（履歴表示に影響するため再描画する）
  const saveButtonDisplayConfig = async () => {
    await ConfigManager.saveButtonDisplayConfig({
      showCopyButton: isChecked(CONFIG_DOM_IDS.SHOW_COPY_BUTTON),
      showRerunButton: isChecked(CONFIG_DOM_IDS.SHOW_RERUN_BUTTON),
      showDeleteButton: isChecked(CONFIG_DOM_IDS.SHOW_DELETE_BUTTON)
    });
    await refreshHistories();
    notifySaved();
  };
  [
    CONFIG_DOM_IDS.SHOW_COPY_BUTTON,
    CONFIG_DOM_IDS.SHOW_RERUN_BUTTON,
    CONFIG_DOM_IDS.SHOW_DELETE_BUTTON
  ].forEach((id) => addChangeListener(id, saveButtonDisplayConfig));

  // API名コピー形式設定
  const saveCopyFormatConfig = async () => {
    await ConfigManager.saveCopyFormatConfig({
      copyIncludeDisplayName: isChecked(CONFIG_DOM_IDS.COPY_INCLUDE_DISPLAY_NAME),
      copyIncludeApiName: isChecked(CONFIG_DOM_IDS.COPY_INCLUDE_API_NAME),
      copyIncludeUrl: isChecked(CONFIG_DOM_IDS.COPY_INCLUDE_URL)
    });
    notifySaved();
  };
  [
    CONFIG_DOM_IDS.COPY_INCLUDE_DISPLAY_NAME,
    CONFIG_DOM_IDS.COPY_INCLUDE_API_NAME,
    CONFIG_DOM_IDS.COPY_INCLUDE_URL
  ].forEach((id) => addChangeListener(id, saveCopyFormatConfig));

  // 実行ログ設定
  addChangeListener(CONFIG_DOM_IDS.SHOW_EXECUTION_LOG, async () => {
    await ConfigManager.saveExecutionLogEnabled(isChecked(CONFIG_DOM_IDS.SHOW_EXECUTION_LOG, false));
    notifySaved();
  });

  // 履歴保存数（デバウンス + 範囲クランプ）
  const historyLimitInput = document.getElementById(CONFIG_DOM_IDS.HISTORY_LIMIT);
  if (historyLimitInput) {
    let debounceTimer;
    historyLimitInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const value = parseInt(historyLimitInput.value);
        if (isNaN(value)) return;
        const clamped = Math.min(Math.max(HISTORY_CONFIG.MIN_LIMIT, value), HISTORY_CONFIG.MAX_LIMIT);
        if (clamped !== value) {
          historyLimitInput.value = clamped;
        }
        await ConfigManager.setHistoryLimit(clamped);
        await HistoryManager.trimToLimit();
        await refreshHistories();
        notifySaved();
      }, TIMING.INPUT_DEBOUNCE);
    });
  }
}

/**
 * API名コピーボタンをセットアップ
 */
function setupApiNameCopyButtons() {
  const restCopyBtn = document.getElementById(REST_DOM_IDS.COPY_NAME_BTN);
  const jsCopyBtn = document.getElementById(JS_DOM_IDS.COPY_NAME_BTN);
  const userCopyBtn = document.getElementById(USER_DOM_IDS.COPY_NAME_BTN);

  async function copyApiName(apiName, definitionManager, buttonEl) {
    if (!apiName) return;
    const definition = definitionManager.getDefinition(apiName);
    if (!definition) return;
    const format = await ConfigManager.getCopyFormatConfig();
    const parts = [];
    if (format.copyIncludeDisplayName && definition.displayName) parts.push(definition.displayName);
    if (format.copyIncludeApiName) parts.push(definition.name || apiName);
    if (format.copyIncludeUrl && definition.docUrl) parts.push(definition.docUrl);
    const text = parts.length > 0 ? parts.join('：') : (definition.name || apiName);
    await navigator.clipboard.writeText(text);
    if (buttonEl) {
      const originalLabel = buttonEl.textContent;
      buttonEl.textContent = 'コピーしました';
      setTimeout(() => {
        buttonEl.textContent = originalLabel;
      }, TIMING.BUTTON_FEEDBACK_DISPLAY);
    }
  }

  if (restCopyBtn) {
    restCopyBtn.addEventListener('click', async () => {
      const apiName = restApiSelector.getSelectedApiName();
      await copyApiName(apiName, restApiDefinitionManager, restCopyBtn);
    });
  }
  if (jsCopyBtn) {
    jsCopyBtn.addEventListener('click', async () => {
      const apiName = jsApiSelector.getSelectedApiName();
      await copyApiName(apiName, jsApiDefinitionManager, jsCopyBtn);
    });
  }
  if (userCopyBtn) {
    userCopyBtn.addEventListener('click', async () => {
      const apiName = userApiSelector.getSelectedApiName();
      await copyApiName(apiName, userApiDefinitionManager, userCopyBtn);
    });
  }
}

/**
 * JS API 画面フィルターのイベントをセットアップ
 */
function setupJsApiFilter() {
  const screenSelect = document.getElementById(JS_DOM_IDS.FILTER_SCREEN);
  const platformRadios = document.querySelectorAll(`input[name="${JS_DOM_IDS.FILTER_PLATFORM_NAME}"]`);

  const onFilterChange = () => {
    if (jsApiSelector) jsApiSelector.refresh();
  };

  screenSelect?.addEventListener('change', onFilterChange);
  platformRadios.forEach(r => r.addEventListener('change', onFilterChange));
}

// ===== タブ遷移リンク =====

/**
 * data-open-tab 属性を持つボタンでタブを切り替えられるようにする
 * （実行先未設定バナーや初回ガイドの「Settingを開く」で使用。動的生成要素にも効くよう委譲で登録）
 */
function setupTabNavigationLinks() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-tab]');
    if (trigger && tabManager) {
      tabManager.setActiveTab(trigger.dataset.openTab);
    }
  });
}

// ===== 実行先未設定バナー =====

/**
 * API実行先（kintoneタブ）が解決できるかを判定
 * ConfigManager.getKintoneDomainForExecution と同じ優先順位で、副作用なしに確認する。
 * @returns {Promise<boolean>}
 */
async function isExecutionTargetAvailable() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && isKintoneUrl(activeTab.url)) return true;

    const savedTabId = await ConfigManager.getKintoneTabId();
    if (!savedTabId) return false;

    const tab = await chrome.tabs.get(savedTabId);
    return isKintoneUrl(tab.url);
  } catch (e) {
    return false;
  }
}

/**
 * 実行先未設定バナーの表示/非表示を更新
 */
async function updateExecutionTargetBanners() {
  const available = await isExecutionTargetAvailable();
  document.querySelectorAll('.info-banner[data-banner="kintone-tab"]').forEach((banner) => {
    banner.classList.toggle(CSS_CLASSES.HIDDEN, available);
  });
}

/**
 * 実行先未設定バナーをセットアップ
 * アクティブタブの切り替え・URL変更・タブ記憶の変更に追従して自動更新する。
 */
function setupExecutionTargetBanner() {
  updateExecutionTargetBanners();

  chrome.tabs.onActivated.addListener(() => updateExecutionTargetBanners());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      updateExecutionTargetBanners();
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.KINTONE_TAB_ID]) {
      updateExecutionTargetBanners();
    }
  });
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
        showToast(ERROR_MESSAGES.NO_ACTIVE_TAB, { type: 'error' });
        return;
      }

      // kintoneドメインかチェック（ラベル境界で *.cybozu.com に厳密一致）
      if (!isKintoneUrl(tab.url)) {
        showToast(ERROR_MESSAGES.NOT_KINTONE_TAB, { type: 'error' });
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

      showToast('タブを記憶しました', { type: 'success' });
    } catch (e) {
      showToast(e.message, { type: 'error' });
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
      // タブ情報を表示（スタイルは .tab-info-title / .tab-info-url のCSSで適用）
      const titleElement = tabInfoDisplay.querySelector('.tab-info-title');
      const urlElement = tabInfoDisplay.querySelector('.tab-info-url');

      if (titleElement) {
        titleElement.textContent = tabInfo.title || 'タイトルなし';
      }
      if (urlElement) {
        urlElement.textContent = tabInfo.url || 'URLなし';
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
      showToast('タブの記憶を削除しました', { type: 'info' });
    });
  }
}
