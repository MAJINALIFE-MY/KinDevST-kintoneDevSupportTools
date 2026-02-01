/**
 * KinDevST 設定管理モジュール
 * Chrome Storage APIのラッパーとして、設定の読み込み/保存を一元管理
 */

'use strict';

import { STORAGE_KEYS, HISTORY_CONFIG, AUTH_TYPES, KINTONE_DOMAIN_PATTERN, ERROR_MESSAGES } from './constants.js';
import { encrypt, decrypt } from './crypto-manager.js';

/**
 * 設定管理クラス
 */
export class ConfigManager {
  /**
   * 履歴保存数の上限を取得
   * @returns {Promise<number>} 履歴保存数
   */
  static async getHistoryLimit() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.HISTORY_LIMIT], (items) => {
        const limit = items[STORAGE_KEYS.HISTORY_LIMIT] || HISTORY_CONFIG.DEFAULT_LIMIT;
        resolve(Math.min(Math.max(HISTORY_CONFIG.MIN_LIMIT, limit), HISTORY_CONFIG.MAX_LIMIT));
      });
    });
  }

  /**
   * 履歴保存数を設定
   * @param {number} limit - 履歴保存数
   * @returns {Promise<void>}
   */
  static async setHistoryLimit(limit) {
    const validLimit = Math.min(Math.max(HISTORY_CONFIG.MIN_LIMIT, limit), HISTORY_CONFIG.MAX_LIMIT);
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.HISTORY_LIMIT]: validLimit }, resolve);
    });
  }

  /**
   * 認証設定を取得
   * @returns {Promise<Object>} 認証設定オブジェクト
   */
  static async getAuthConfig() {
    return new Promise(async (resolve) => {
      chrome.storage.session.get([
        STORAGE_KEYS.AUTH_TYPE,
        STORAGE_KEYS.AUTH_USER,
        STORAGE_KEYS.AUTH_PASS,
        STORAGE_KEYS.AUTH_API_TOKEN,
        STORAGE_KEYS.OAUTH_CLIENT_ID,
        STORAGE_KEYS.OAUTH_CLIENT_SECRET
      ], async (items) => {
        // デフォルトはセッション認証（kintoneのCookieを使用）
        const authType = items[STORAGE_KEYS.AUTH_TYPE] || AUTH_TYPES.SESSION;
        const config = { authType };
        
        switch (authType) {
          case AUTH_TYPES.PASSWORD:
            config.username = items[STORAGE_KEYS.AUTH_USER] ? await decrypt(items[STORAGE_KEYS.AUTH_USER]) : '';
            config.password = items[STORAGE_KEYS.AUTH_PASS] ? await decrypt(items[STORAGE_KEYS.AUTH_PASS]) : '';
            break;
          case AUTH_TYPES.TOKEN:
            config.apiToken = items[STORAGE_KEYS.AUTH_API_TOKEN] ? await decrypt(items[STORAGE_KEYS.AUTH_API_TOKEN]) : '';
            break;
          case AUTH_TYPES.OAUTH:
            config.clientId = items[STORAGE_KEYS.OAUTH_CLIENT_ID] ? await decrypt(items[STORAGE_KEYS.OAUTH_CLIENT_ID]) : '';
            config.clientSecret = items[STORAGE_KEYS.OAUTH_CLIENT_SECRET] ? await decrypt(items[STORAGE_KEYS.OAUTH_CLIENT_SECRET]) : '';
            // Note: OAuth認証は現在未実装。将来的にアクセストークン取得フローを追加予定
            config.accessToken = '';
            break;
          case AUTH_TYPES.SESSION:
            // セッション認証（Cookieを使用）は特別な設定不要
            break;
        }
        
        resolve(config);
      });
    });
  }

  /**
   * 認証設定を保存
   * @param {Object} config - 認証設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveAuthConfig(config) {
    const encrypted = {
      [STORAGE_KEYS.AUTH_TYPE]: config.authType
    };
    
    if (config.authUser) encrypted[STORAGE_KEYS.AUTH_USER] = await encrypt(config.authUser);
    if (config.authPass) encrypted[STORAGE_KEYS.AUTH_PASS] = await encrypt(config.authPass);
    if (config.authApiToken) encrypted[STORAGE_KEYS.AUTH_API_TOKEN] = await encrypt(config.authApiToken);
    if (config.oauthClientId) encrypted[STORAGE_KEYS.OAUTH_CLIENT_ID] = await encrypt(config.oauthClientId);
    if (config.oauthClientSecret) encrypted[STORAGE_KEYS.OAUTH_CLIENT_SECRET] = await encrypt(config.oauthClientSecret);
    
    return new Promise((resolve) => {
      chrome.storage.session.set(encrypted, resolve);
    });
  }

  /**
   * 全設定を読み込み
   * @returns {Promise<Object>} 全設定オブジェクト
   */
  static async loadAllConfig() {
    // 認証情報はsessionストレージから、その他はlocalストレージから取得
    return new Promise(async (resolve) => {
      // 認証情報をsessionストレージから取得
      chrome.storage.session.get([
        STORAGE_KEYS.AUTH_TYPE,
        STORAGE_KEYS.AUTH_USER,
        STORAGE_KEYS.AUTH_PASS,
        STORAGE_KEYS.AUTH_API_TOKEN,
        STORAGE_KEYS.OAUTH_CLIENT_ID,
        STORAGE_KEYS.OAUTH_CLIENT_SECRET
      ], async (authItems) => {
        // その他の設定をlocalストレージから取得
        chrome.storage.local.get([
          STORAGE_KEYS.HISTORY_LIMIT,
          STORAGE_KEYS.SHOW_REQUEST_HEADERS,
          STORAGE_KEYS.SHOW_STATUS_CODE,
          STORAGE_KEYS.SHOW_RESPONSE_HEADERS,
          STORAGE_KEYS.SHOW_COPY_BUTTON,
          STORAGE_KEYS.SHOW_RERUN_BUTTON,
          STORAGE_KEYS.SHOW_DELETE_BUTTON,
          STORAGE_KEYS.SHOW_EXECUTION_LOG
        ], async (otherItems) => {
          resolve({
            // デフォルトはセッション認証（kintoneのCookieを使用）
            authType: authItems[STORAGE_KEYS.AUTH_TYPE] || AUTH_TYPES.SESSION,
            authUser: authItems[STORAGE_KEYS.AUTH_USER] ? await decrypt(authItems[STORAGE_KEYS.AUTH_USER]) : '',
            authPass: authItems[STORAGE_KEYS.AUTH_PASS] ? await decrypt(authItems[STORAGE_KEYS.AUTH_PASS]) : '',
            authApiToken: authItems[STORAGE_KEYS.AUTH_API_TOKEN] ? await decrypt(authItems[STORAGE_KEYS.AUTH_API_TOKEN]) : '',
            oauthClientId: authItems[STORAGE_KEYS.OAUTH_CLIENT_ID] ? await decrypt(authItems[STORAGE_KEYS.OAUTH_CLIENT_ID]) : '',
            oauthClientSecret: authItems[STORAGE_KEYS.OAUTH_CLIENT_SECRET] ? await decrypt(authItems[STORAGE_KEYS.OAUTH_CLIENT_SECRET]) : '',
            historyLimit: Math.min(
              Math.max(HISTORY_CONFIG.MIN_LIMIT, otherItems[STORAGE_KEYS.HISTORY_LIMIT] || HISTORY_CONFIG.DEFAULT_LIMIT),
              HISTORY_CONFIG.MAX_LIMIT
            ),
            showRequestHeaders: otherItems[STORAGE_KEYS.SHOW_REQUEST_HEADERS] !== undefined ? otherItems[STORAGE_KEYS.SHOW_REQUEST_HEADERS] : true,
            showStatusCode: otherItems[STORAGE_KEYS.SHOW_STATUS_CODE] !== undefined ? otherItems[STORAGE_KEYS.SHOW_STATUS_CODE] : true,
            showResponseHeaders: otherItems[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] !== undefined ? otherItems[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] : true,
            showCopyButton: otherItems[STORAGE_KEYS.SHOW_COPY_BUTTON] !== undefined ? otherItems[STORAGE_KEYS.SHOW_COPY_BUTTON] : true,
            showRerunButton: otherItems[STORAGE_KEYS.SHOW_RERUN_BUTTON] !== undefined ? otherItems[STORAGE_KEYS.SHOW_RERUN_BUTTON] : true,
            showDeleteButton: otherItems[STORAGE_KEYS.SHOW_DELETE_BUTTON] !== undefined ? otherItems[STORAGE_KEYS.SHOW_DELETE_BUTTON] : true,
            showExecutionLog: otherItems[STORAGE_KEYS.SHOW_EXECUTION_LOG] !== undefined ? otherItems[STORAGE_KEYS.SHOW_EXECUTION_LOG] : false
          });
        });
      });
    });
  }

  /**
   * REST API表示設定を取得
   * @returns {Promise<Object>} 表示設定オブジェクト
   */
  static async getRestApiDisplayConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.SHOW_REQUEST_HEADERS,
        STORAGE_KEYS.SHOW_STATUS_CODE,
        STORAGE_KEYS.SHOW_RESPONSE_HEADERS
      ], (items) => {
        resolve({
          showRequestHeaders: items[STORAGE_KEYS.SHOW_REQUEST_HEADERS] !== undefined ? items[STORAGE_KEYS.SHOW_REQUEST_HEADERS] : true,
          showStatusCode: items[STORAGE_KEYS.SHOW_STATUS_CODE] !== undefined ? items[STORAGE_KEYS.SHOW_STATUS_CODE] : true,
          showResponseHeaders: items[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] !== undefined ? items[STORAGE_KEYS.SHOW_RESPONSE_HEADERS] : true
        });
      });
    });
  }

  /**
   * REST API表示設定を保存
   * @param {Object} config - 表示設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveRestApiDisplayConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.SHOW_REQUEST_HEADERS]: config.showRequestHeaders,
        [STORAGE_KEYS.SHOW_STATUS_CODE]: config.showStatusCode,
        [STORAGE_KEYS.SHOW_RESPONSE_HEADERS]: config.showResponseHeaders
      }, resolve);
    });
  }

  /**
   * ボタン表示設定を取得（REST APIとJS API共通）
   * @returns {Promise<Object>} ボタン表示設定オブジェクト
   */
  static async getButtonDisplayConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        STORAGE_KEYS.SHOW_COPY_BUTTON,
        STORAGE_KEYS.SHOW_RERUN_BUTTON,
        STORAGE_KEYS.SHOW_DELETE_BUTTON
      ], (items) => {
        resolve({
          showCopyButton: items[STORAGE_KEYS.SHOW_COPY_BUTTON] !== undefined ? items[STORAGE_KEYS.SHOW_COPY_BUTTON] : true,
          showRerunButton: items[STORAGE_KEYS.SHOW_RERUN_BUTTON] !== undefined ? items[STORAGE_KEYS.SHOW_RERUN_BUTTON] : true,
          showDeleteButton: items[STORAGE_KEYS.SHOW_DELETE_BUTTON] !== undefined ? items[STORAGE_KEYS.SHOW_DELETE_BUTTON] : true
        });
      });
    });
  }

  /**
   * ボタン表示設定を保存（REST APIとJS API共通）
   * @param {Object} config - ボタン表示設定オブジェクト
   * @returns {Promise<void>}
   */
  static async saveButtonDisplayConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.SHOW_COPY_BUTTON]: config.showCopyButton,
        [STORAGE_KEYS.SHOW_RERUN_BUTTON]: config.showRerunButton,
        [STORAGE_KEYS.SHOW_DELETE_BUTTON]: config.showDeleteButton
      }, resolve);
    });
  }

  /**
   * 実行ログ設定を取得
   * @returns {Promise<boolean>} 実行ログ表示設定（デフォルト: false）
   */
  static async getExecutionLogEnabled() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.SHOW_EXECUTION_LOG], (items) => {
        resolve(items[STORAGE_KEYS.SHOW_EXECUTION_LOG] !== undefined ? items[STORAGE_KEYS.SHOW_EXECUTION_LOG] : false);
      });
    });
  }

  /**
   * 実行ログ設定を保存
   * @param {boolean} enabled - 実行ログ表示設定
   * @returns {Promise<void>}
   */
  static async saveExecutionLogEnabled(enabled) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.SHOW_EXECUTION_LOG]: enabled
      }, resolve);
    });
  }

  /**
   * 認証情報をクリア（ログアウト）
   * @returns {Promise<void>}
   */
  static async clearAuthCredentials() {
    return new Promise((resolve) => {
      chrome.storage.session.remove([
        STORAGE_KEYS.AUTH_TYPE,
        STORAGE_KEYS.AUTH_USER,
        STORAGE_KEYS.AUTH_PASS,
        STORAGE_KEYS.AUTH_API_TOKEN,
        STORAGE_KEYS.OAUTH_CLIENT_ID,
        STORAGE_KEYS.OAUTH_CLIENT_SECRET
      ], resolve);
    });
  }

  /**
   * OAuth用のリダイレクトURIを取得
   * @returns {string} リダイレクトURI
   */
  static getOAuthRedirectUri() {
    return chrome.identity ? chrome.identity.getRedirectURL() : 'https://<ExtensionID>.chromiumapp.org/';
  }

  /**
   * 保存されたkintoneタブIDを取得
   * @returns {Promise<number|null>} タブID（保存されていない場合はnull）
   */
  static async getKintoneTabId() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.KINTONE_TAB_ID], (items) => {
        const tabId = items[STORAGE_KEYS.KINTONE_TAB_ID];
        resolve(tabId !== undefined ? tabId : null);
      });
    });
  }

  /**
   * 保存されたkintoneタブ情報を取得
   * @returns {Promise<Object|null>} タブ情報（{ title: string, url: string }）保存されていない場合はnull
   */
  static async getKintoneTabInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.KINTONE_TAB_INFO], (items) => {
        const tabInfo = items[STORAGE_KEYS.KINTONE_TAB_INFO];
        resolve(tabInfo !== undefined ? tabInfo : null);
      });
    });
  }

  /**
   * kintoneタブIDと情報を保存
   * @param {number} tabId - タブID
   * @param {Object} tabInfo - タブ情報 { title: string, url: string }
   * @returns {Promise<void>}
   */
  static async saveKintoneTab(tabId, tabInfo) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [STORAGE_KEYS.KINTONE_TAB_ID]: tabId,
        [STORAGE_KEYS.KINTONE_TAB_INFO]: tabInfo
      }, resolve);
    });
  }

  /**
   * kintoneタブ情報をクリア
   * @returns {Promise<void>}
   */
  static async clearKintoneTab() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([
        STORAGE_KEYS.KINTONE_TAB_ID,
        STORAGE_KEYS.KINTONE_TAB_INFO
      ], resolve);
    });
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
    
    if (activeTab && activeTab.url && activeTab.url.includes(KINTONE_DOMAIN_PATTERN)) {
      // アクティブタブがcybozu.comの場合は優先して使用
      // 自動で保存（記憶を更新）
      const tabInfo = {
        title: activeTab.title || '',
        url: activeTab.url || ''
      };
      await ConfigManager.saveKintoneTab(activeTab.id, tabInfo);
      return activeTab.id;
    }
    
    // アクティブタブがcybozu.comでない場合、保存されたタブIDを使用
    const savedTabId = await ConfigManager.getKintoneTabId();
    
    if (savedTabId) {
      // 保存されたタブIDがある場合、タブが存在するか確認
      try {
        await chrome.tabs.get(savedTabId);
        return savedTabId;
      } catch (e) {
        // タブが存在しない場合はエラー
        throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
      }
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
    
    if (activeTab && activeTab.url && activeTab.url.includes(KINTONE_DOMAIN_PATTERN)) {
      // アクティブタブがcybozu.comの場合は優先して使用
      const urlObj = new URL(activeTab.url);
      const domain = urlObj.hostname;
      
      // 自動で保存（記憶を更新）
      const tabInfo = {
        title: activeTab.title || '',
        url: activeTab.url || ''
      };
      await ConfigManager.saveKintoneTab(activeTab.id, tabInfo);
      return domain;
    }
    
    // アクティブタブがcybozu.comでない場合、保存されたタブIDを使用
    const savedTabId = await ConfigManager.getKintoneTabId();
    
    if (savedTabId) {
      // 保存されたタブIDがある場合、タブが存在するか確認
      try {
        const tab = await chrome.tabs.get(savedTabId);
        if (tab && tab.url) {
          const urlObj = new URL(tab.url);
          return urlObj.hostname;
        }
      } catch (e) {
        // タブが存在しない場合はエラー
        throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
      }
    }
    
    // 保存されたタブIDもない場合はエラー
    throw new Error(ERROR_MESSAGES.KINTONE_TAB_NOT_FOUND);
  }
}
