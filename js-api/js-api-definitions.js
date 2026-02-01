/**
 * KinDevST JS API定義管理クラス
 * BaseDefinitionManagerを継承し、重複API解決機能を追加
 */

'use strict';

import { BaseDefinitionManager } from '../utils/base-definition-manager.js';

/**
 * JS API定義管理クラス
 */
export class JSAPIDefinitionManager extends BaseDefinitionManager {
  constructor() {
    super();
  }

  /**
   * 定義マップを構築（重複API解決機能付き）
   * @protected
   * @override
   * @param {Array} data - カテゴリデータの配列
   */
  _buildDefinitionMap(data) {
    // 1. まず全ての非重複定義をマップに登録
    data.forEach(category => {
      if (category.apis) {
        category.apis.forEach(api => {
          if (!api.duplicate) {
            this.definitions.set(api.name, api);
          }
        });
      }
    });
    
    // 2. 重複定義を解決し、displayNameに【重複】を付与
    data.forEach(category => {
      if (category.apis) {
        category.apis.forEach(api => {
          if (api.duplicate) {
            const original = this.definitions.get(api.duplicate);
            if (original) {
              // 参照先の定義をマージ（displayNameには【重複】を付与）
              const resolvedApi = {
                ...original,
                displayName: `【重複】${original.displayName}`
              };
              // このカテゴリ用に解決済み定義を設定（元のnameは保持）
              Object.assign(api, resolvedApi);
            }
          }
        });
      }
    });
  }

  /**
   * 全カテゴリとAPIの構造を取得（プルダウン生成用）
   * 重複APIのdisplayNameを解決して返す
   * @override
   * @returns {Array<Object>} カテゴリ定義の配列
   */
  getCategories() {
    // カテゴリのディープコピーを作成して返す（元のデータを変更しない）
    return this.categories.map(category => ({
      ...category,
      apis: category.apis ? category.apis.map(api => {
        // 重複APIの場合はdisplayNameを解決
        if (api.duplicate) {
          const original = this.definitions.get(api.duplicate);
          if (original && original.displayName) {
            return {
              ...api,
              displayName: api.displayName || `【重複】${original.displayName}`
            };
          }
        }
        return api;
      }) : []
    }));
  }
}
