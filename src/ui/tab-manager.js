/**
 * KinDevST タブ管理モジュール
 * タブの切り替えと認証方式の選択を管理
 */

'use strict';

import { CSS_CLASSES, AUTH_TYPES } from '../utils/constants.js';

/**
 * タブ管理クラス
 */
export class TabManager {
  /**
   * @param {Object} options - オプション
   * @param {Function} options.onTabChange - タブ変更時のコールバック
   */
  constructor(options = {}) {
    this.onTabChange = options.onTabChange || (() => {});
    this.tabs = null;
    this.contents = null;
  }

  /**
   * タブ切り替えをセットアップ
   */
  setupTabs() {
    this.tabs = document.querySelectorAll('.tab-button');
    this.contents = document.querySelectorAll('.tab-content');

    this.tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        // アクティブなタブをリセット
        this.tabs.forEach(t => t.classList.remove(CSS_CLASSES.ACTIVE));
        this.contents.forEach(c => c.classList.remove(CSS_CLASSES.ACTIVE));

        // クリックされたタブをアクティブに
        tab.classList.add(CSS_CLASSES.ACTIVE);
        const targetId = tab.getAttribute('data-tab');
        document.getElementById(targetId).classList.add(CSS_CLASSES.ACTIVE);
        
        // コールバックを実行
        await this.onTabChange(targetId);
      });
    });
  }

  /**
   * 現在アクティブなタブIDを取得
   * @returns {string|null} タブID
   */
  getActiveTabId() {
    const activeTab = document.querySelector('.tab-button.active');
    return activeTab ? activeTab.getAttribute('data-tab') : null;
  }

  /**
   * プログラム的にタブを切り替え
   * @param {string} tabId - タブID
   */
  setActiveTab(tabId) {
    const tab = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (tab) {
      tab.click();
    }
  }
}

/**
 * 認証方式セレクター管理クラス
 */
export class AuthSectionManager {
  /**
   * @param {string} selectorId - 認証方式セレクターのID
   */
  constructor(selectorId = 'auth-type') {
    this.selectorId = selectorId;
    this.selector = null;
  }

  /**
   * 認証方式セレクターをセットアップ
   */
  setup() {
    this.selector = document.getElementById(this.selectorId);
    if (!this.selector) {
      console.error('認証方式セレクターが見つかりません');
      return;
    }
    
    this.selector.addEventListener('change', (e) => {
      this.updateSection(e.target.value);
    });
  }

  /**
   * 認証セクションの表示を更新
   * @param {string} type - 認証方式
   */
  updateSection(type) {
    const sections = document.querySelectorAll('.auth-method-section');
    // 全てのセクションを非表示
    sections.forEach(s => s.classList.remove(CSS_CLASSES.ACTIVE));

    // 選択された方式に対応するセクションを表示
    const targetSection = document.getElementById(`auth-${type}`);
    if (targetSection) {
      targetSection.classList.add(CSS_CLASSES.ACTIVE);
    }
  }

  /**
   * 現在選択されている認証方式を取得
   * @returns {string} 認証方式
   */
  getSelectedAuthType() {
    return this.selector ? this.selector.value : AUTH_TYPES.PASSWORD;
  }

  /**
   * 認証方式をプログラム的に設定
   * @param {string} type - 認証方式
   */
  setAuthType(type) {
    if (this.selector) {
      this.selector.value = type;
      this.updateSection(type);
    }
  }
}
