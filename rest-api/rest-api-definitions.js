/**
 * KinDevST REST API定義管理クラス
 * BaseDefinitionManagerを継承
 */

'use strict';

import { BaseDefinitionManager } from '../utils/base-definition-manager.js';

/**
 * REST API定義管理クラス
 */
export class RESTAPIDefinitionManager extends BaseDefinitionManager {
  constructor() {
    super();
  }
  
  // REST APIは基底クラスの実装をそのまま使用
  // 追加の処理が必要な場合はここにオーバーライドを追加
}
