/**
 * KinDevST API定義マネージャー基底クラス
 * REST APIとJS APIで共通の定義管理ロジックを提供
 */

'use strict';

/**
 * API定義マネージャー基底クラス
 */
export class BaseDefinitionManager {
  constructor() {
    this.definitions = new Map();
    this.categories = [];
  }

  /**
   * JSONファイルから定義をロードする
   * @param {string} url - JSONファイルのパス
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async loadDefinitions(url) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      this.categories = data;
      
      // 定義マップの構築（サブクラスでオーバーライド可能）
      this._buildDefinitionMap(data);
      
      return true;
    } catch (e) {
      console.error(`Failed to load API definitions from ${url}:`, e);
      return false;
    }
  }

  /**
   * 定義マップを構築
   * サブクラスでオーバーライド可能
   * @protected
   * @param {Array} data - カテゴリデータの配列
   */
  _buildDefinitionMap(data) {
    data.forEach(category => {
      if (category.apis) {
        category.apis.forEach(api => {
          this.definitions.set(api.name, api);
        });
      }
    });
  }

  /**
   * API定義を取得
   * @param {string} apiName - API名
   * @returns {Object|undefined} API定義
   */
  getDefinition(apiName) {
    return this.definitions.get(apiName);
  }

  /**
   * 全カテゴリとAPIの構造を取得（プルダウン生成用）
   * @returns {Array<Object>} カテゴリ定義の配列
   */
  getCategories() {
    return this.categories;
  }

  /**
   * 全API定義を取得
   * @returns {Map} 定義マップ
   */
  getAllDefinitions() {
    return this.definitions;
  }

  /**
   * API定義が存在するか確認
   * @param {string} apiName - API名
   * @returns {boolean}
   */
  hasDefinition(apiName) {
    return this.definitions.has(apiName);
  }
}
