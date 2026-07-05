/**
 * KinDevST 設定管理モジュール
 * Chrome Storage APIのラッパーとして、設定の読み込み/保存を一元管理
 */

'use strict';

import { STORAGE_KEYS, HISTORY_CONFIG, AUTH_TYPES, ERROR_MESSAGES, CONFIG_DOM_IDS } from './constants.js';
import { isKintoneUrl } from './domain-validator.js';

/**
 * 設定管理クラス
 */
export class ConfigManager {
  /**
   * 履歴保存数の上限を取得
   * @returns {Promise<number>} 履歴保存数
   */
  static async getHistoryLimit() {
    const items = await chrome.storage.local.get([STORAGE_KEYS.HISTORY_LIMIT]);
    const limit = items[STORAGE_KEYS.HISTORY_LIMIT] ?? HISTORY_CONFIG.DEFAULT_LIMIT;
    return Math.min(Math.max(HISTORY_CONFIG.MIN_LIMIT, limit), HISTORY_CONFIG.MAX_LIMIT);
  }

  /**
   * 履歴保存数を設定
   * @param {number} limit - 履歴保存数
   * @returns {Promise<void>}
   */
  static async setHistoryLimit(limit) {
    const validLimit = Math.min(Math.max(HISTORY_CONFIG.MIN_LIMIT, limit), HISTORY_CONFIG.MAX_LIMIT);
    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY_LIMIT]: validLimit });
  }

  /**
   * 認証設定を取得（フォーム入力から直接構築。認証情報は永続化しない）
   *
   * セキュリティ方針：パスワード / APIトークン等の認証情報はストレージに一切保存せず、
   * 実行のたびにサイドパネルのフォームから読み取ってメモリ上でのみ受け渡す。
   * @returns {Object} 認証設定オブジェクト
   */
  static getAuthConfig() {
    const getVal = (id) => document.getElementById(id)?.value || '';

    // デフォルトはセッション認証（kintoneのCookieを使用）
    const authType = getVal(CONFIG_DOM_IDS.AUTH_TYPE) || AUTH_TYPES.SESSION;
    const config = { authType };

    switch (authType) {
      case AUTH_TYPES.PASSWORD:
        config.username = getVal(CONFIG_DOM_IDS.AUTH_USER);
        config.password = getVal(CONFIG_DOM_IDS.AUTH_PASS);
        break;
      case AUTH_TYPES.TOKEN:
        config.apiToken = getVal(CONFIG_DOM_IDS.AUTH_API_TOKEN);
        break;
      case AUTH_TYPES.SESSION:
        // セッション認証（Cookieを使用）は特別な設定不要
        break;
    }

    return config;
  }

  /**
   * 全設定を読み込み（認証情報は永続化しないため対象外）
   * @returns {Promise<Object>} 全設定オブジェクト
   */
  static async loadAllConfig() {
    const otherItems = await chrome.storage.local.get([
      STORAGE_KEYS.HISTORY_LIMIT,
      STORAGE_KEYS.SHOW_REQUEST_HEADERS,
      STORAGE_KEYS.SHOW_STATUS_CODE,
      STORAGE_KEYS.SHOW_RESPONSE_HEADERS,
      STORAGE_KEYS.SHOW_COPY_BUTTON,
      STORAGE_KEYS.SHOW_RERUN_BUTTON,
      STORAGE_KEYS.SHOW_DELETE_BUTTON,
      STORAGE_KEYS.SHOW_EXECUTION_LOG,
      STORAGE_KEYS.COPY_INCLUDE_DISPLAY_NAME,
      STORAGE_KEYS.COPY_INCLUDE_API_NAME,
      STORAGE_KEYS.COPY_INCLUDE_URL
    ]);

    return {
      // デフォルトはセッション認証（kintoneのCookieを使用）
      authType: AUTH_TYPES.SESSION,
      historyLimit: Math.min(
        Math.max(HISTORY_CONFIG.MIN_LIMIT, otherItems[STORAGE_KEYS.HISTORY_LIMIT] ?? HISTORY_CONFIG.DEFAULT_LIMIT),
        HISTORY_CONFIG.MAX_LIMIT
      ),
      showRequestHeaders: otherItems[STORAGE_KEYS.SHOW_REQUEST_HEADERS] ?? true,
      showStatusCode: otherItems[STORAGE_KEYS.SHOW_STATUS_CODE] ?? true,
      showResponseHeaders: otherItems[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] ?? true,
      showCopyButton: otherItems[STORAGE_KEYS.SHOW_COPY_BUTTON] ?? true,
      showRerunButton: otherItems[STORAGE_KEYS.SHOW_RERUN_BUTTON] ?? true,
      showDeleteButton: otherItems[STORAGE_KEYS.SHOW_DELETE_BUTTON] ?? true,
      showExecutionLog: otherItems[STORAGE_KEYS.SHOW_EXECUTION_LOG] ?? false,
      copyIncludeDisplayName: otherItems[STORAGE_KEYS.COPY_INCLUDE_DISPLAY_NAME] ?? true,
      copyIncludeApiName: otherItems[STORAGE_KEYS.COPY_INCLUDE_API_NAME] ?? true,
      copyIncludeUrl: otherItems[STORAGE_KEYS.COPY_INCLUDE_URL] ?? true
    };
  }

  /**
   * API名コピー時の形式設定を取得
   * @returns {Promise<Object>} コピー形式設定オブジェクト
   */
  static async getCopyFormatConfig() {
    const items = await chrome.storage.local.get([
      STORAGE_KEYS.COPY_INCLUDE_DISPLAY_NAME,
      STORAGE_KEYS.COPY_INCLUDE_API_NAME,
      STORAGE_KEYS.COPY_INCLUDE_URL
    ]);
    return {
      copyIncludeDisplayName: items[STORAGE_KEYS.COPY_INCLUDE_DISPLAY_NAME] ?? true,
      copyIncludeApiName: items[STORAGE_KEYS.COPY_INCLUDE_API_NAME] ?? true,
      copyIncludeUrl: items[STORAGE_KEYS.COPY_INCLUDE_URL] ?? true
    };
  }

  /**
   * API名コピー時の形式設定を保存
   * @param {Object} config - コピー形式設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveCopyFormatConfig(config) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.COPY_INCLUDE_DISPLAY_NAME]: config.copyIncludeDisplayName,
      [STORAGE_KEYS.COPY_INCLUDE_API_NAME]: config.copyIncludeApiName,
      [STORAGE_KEYS.COPY_INCLUDE_URL]: config.copyIncludeUrl
    });
  }

  /**
   * REST API表示設定を取得
   * @returns {Promise<Object>} 表示設定オブジェクト
   */
  static async getRestApiDisplayConfig() {
    const items = await chrome.storage.local.get([
      STORAGE_KEYS.SHOW_REQUEST_HEADERS,
      STORAGE_KEYS.SHOW_STATUS_CODE,
      STORAGE_KEYS.SHOW_RESPONSE_HEADERS
    ]);
    return {
      showRequestHeaders: items[STORAGE_KEYS.SHOW_REQUEST_HEADERS] ?? true,
      showStatusCode: items[STORAGE_KEYS.SHOW_STATUS_CODE] ?? true,
      showResponseHeaders: items[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] ?? true
    };
  }

  /**
   * REST API表示設定を保存
   * @param {Object} config - 表示設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveRestApiDisplayConfig(config) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SHOW_REQUEST_HEADERS]: config.showRequestHeaders,
      [STORAGE_KEYS.SHOW_STATUS_CODE]: config.showStatusCode,
      [STORAGE_KEYS.SHOW_RESPONSE_HEADERS]: config.showResponseHeaders
    });
  }

  /**
   * ボタン表示設定を取得（REST APIとJS API共通）
   * @returns {Promise<Object>} ボタン表示設定オブジェクト
   */
  static async getButtonDisplayConfig() {
    const items = await chrome.storage.local.get([
      STORAGE_KEYS.SHOW_COPY_BUTTON,
      STORAGE_KEYS.SHOW_RERUN_BUTTON,
      STORAGE_KEYS.SHOW_DELETE_BUTTON
    ]);
    return {
      showCopyButton: items[STORAGE_KEYS.SHOW_COPY_BUTTON] ?? true,
      showRerunButton: items[STORAGE_KEYS.SHOW_RERUN_BUTTON] ?? true,
      showDeleteButton: items[STORAGE_KEYS.SHOW_DELETE_BUTTON] ?? true
    };
  }

  /**
   * ボタン表示設定を保存（REST APIとJS API共通）
   * @param {Object} config - ボタン表示設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveButtonDisplayConfig(config) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SHOW_COPY_BUTTON]: config.showCopyButton,
      [STORAGE_KEYS.SHOW_RERUN_BUTTON]: config.showRerunButton,
      [STORAGE_KEYS.SHOW_DELETE_BUTTON]: config.showDeleteButton
    });
  }

  /**
   * 実行ログ設定を取得
   * @returns {Promise<boolean>} 実行ログ表示設定（デフォルト: false）
   */
  static async getExecutionLogEnabled() {
    const items = await chrome.storage.local.get([STORAGE_KEYS.SHOW_EXECUTION_LOG]);
    return items[STORAGE_KEYS.SHOW_EXECUTION_LOG] ?? false;
  }

  /**
   * 実行ログ設定を保存
   * @param {boolean} enabled - 実行ログ表示設定
   * @returns {Promise<void>}
   */
  static async saveExecutionLogEnabled(enabled) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SHOW_EXECUTION_LOG]: enabled });
  }

  /**
   * 保存されたkintoneタブIDを取得
   * @returns {Promise<number|null>} タブID（保存されていない場合はnull）
   */
  static async getKintoneTabId() {
    const items = await chrome.storage.local.get([STORAGE_KEYS.KINTONE_TAB_ID]);
    return items[STORAGE_KEYS.KINTONE_TAB_ID] ?? null;
  }

  /**
   * 保存されたkintoneタブ情報を取得
   * @returns {Promise<Object|null>} タブ情報（{ title: string, url: string }）保存されていない場合はnull
   */
  static async getKintoneTabInfo() {
    const items = await chrome.storage.local.get([STORAGE_KEYS.KINTONE_TAB_INFO]);
    return items[STORAGE_KEYS.KINTONE_TAB_INFO] ?? null;
  }

  /**
   * kintoneタブIDと情報を保存
   * @param {number} tabId - タブID
   * @param {Object} tabInfo - タブ情報 { title: string, url: string }
   * @returns {Promise<void>}
   */
  static async saveKintoneTab(tabId, tabInfo) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.KINTONE_TAB_ID]: tabId,
      [STORAGE_KEYS.KINTONE_TAB_INFO]: tabInfo
    });
  }

  /**
   * kintoneタブ情報をクリア
   * @returns {Promise<void>}
   */
  static async clearKintoneTab() {
    await chrome.storage.local.remove([
      STORAGE_KEYS.KINTONE_TAB_ID,
      STORAGE_KEYS.KINTONE_TAB_INFO
    ]);
  }

  /**
   * API実行用のkintoneタブIDを取得（アクティブタブ優先）
   * アクティブタブがcybozu.comの場合は優先して使用し、自動で保存
   * アクティブタブがcybozu.comでない場合、保存されたタブIDを使用
   * @returns {Promise<number>} タブID
   * @throws {Error} タブが見つからない場合
   */
  static async getKintoneTabIdForExecution() {
    // まずアクティブタブを確認（優先）
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && isKintoneUrl(activeTab.url)) {
      // アクティブタブがkintoneドメインの場合は優先して使用
      // 自動で保存（記憶を更新）
      const tabInfo = {
        title: activeTab.title || '',
        url: activeTab.url || ''
      };
      await ConfigManager.saveKintoneTab(activeTab.id, tabInfo);
      return activeTab.id;
    }

    // アクティブタブがkintoneでない場合、保存されたタブIDを使用
    const savedTabId = await ConfigManager.getKintoneTabId();

    if (savedTabId) {
      // 保存されたタブIDがある場合、タブが存在し、かつ現在も kintone ドメインかを確認
      // （記憶後に別サイトへ遷移している可能性があるため URL を再検証する）
      let tab;
      try {
        tab = await chrome.tabs.get(savedTabId);
      } catch (e) {
        throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
      }
      if (!isKintoneUrl(tab.url)) {
        throw new Error(ERROR_MESSAGES.INVALID_KINTONE_DOMAIN);
      }
      return savedTabId;
    }

    // 保存されたタブIDもない場合はエラー
    throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
  }

  /**
   * API実行用のkintoneドメインを取得（アクティブタブ優先）
   * @returns {Promise<string>} kintoneドメイン
   * @throws {Error} タブが見つからない場合
   */
  static async getKintoneDomainForExecution() {
    // まずアクティブタブを確認（優先）
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && isKintoneUrl(activeTab.url)) {
      // アクティブタブがkintoneドメインの場合は優先して使用
      const domain = new URL(activeTab.url).hostname;

      // 自動で保存（記憶を更新）
      const tabInfo = {
        title: activeTab.title || '',
        url: activeTab.url || ''
      };
      await ConfigManager.saveKintoneTab(activeTab.id, tabInfo);
      return domain;
    }

    // アクティブタブがkintoneでない場合、保存されたタブIDを使用
    const savedTabId = await ConfigManager.getKintoneTabId();

    if (savedTabId) {
      // 保存されたタブIDがある場合、タブが存在し、かつ現在も kintone ドメインかを確認
      // （記憶後に別サイトへ遷移している可能性があるため URL を再検証する）
      let tab;
      try {
        tab = await chrome.tabs.get(savedTabId);
      } catch (e) {
        throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
      }
      if (!isKintoneUrl(tab.url)) {
        throw new Error(ERROR_MESSAGES.INVALID_KINTONE_DOMAIN);
      }
      return new URL(tab.url).hostname;
    }

    // 保存されたタブIDもない場合はエラー
    throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
  }
}
