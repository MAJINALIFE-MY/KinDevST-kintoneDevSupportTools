'use strict';

import { USER_DOM_IDS, API_TYPES, ERROR_MESSAGES } from '../utils/constants.js';
import { ConfigManager } from '../utils/config-manager.js';
import { HistoryManager } from '../utils/history-manager.js';

export class UserApiHandler {
  constructor(options) {
    this.definitionManager = options.definitionManager;
    this.executor = options.executor;
    this.selector = options.selector;
  }

  setupExecuteButton() {
    const execBtn = document.getElementById(USER_DOM_IDS.EXEC_BTN);
    if (!execBtn) return;
    execBtn.addEventListener('click', () => this.execute());
  }

  async executeWithHistory(historyItem) {
    let params = null;
    if (historyItem.args) {
      try {
        const args = JSON.parse(historyItem.args);
        if (args && args.length > 0) {
          params = args[0];
        }
      } catch (e) {
        // パースエラーは無視
      }
    }
    await this.execute(params, historyItem.apiName);
  }

  async execute(params = null, apiName = null) {
    if (!apiName) {
      apiName = this.selector.getSelectedApiName();
    }
    const bodyInput = document.getElementById(USER_DOM_IDS.BODY);

    if (!apiName) return;

    const definition = this.definitionManager.getDefinition(apiName);
    if (!definition) return;

    const method = definition.method;
    const endpoint = definition.endpoint;

    if (!method || !endpoint) return;

    try {
      const domain = await ConfigManager.getKintoneDomainForExecution();
      const authConfig = await ConfigManager.getAuthConfig();

      if (params === null) {
        if (bodyInput && bodyInput.value.trim()) {
          try {
            params = JSON.parse(bodyInput.value);
          } catch (e) {
            throw new Error(`${ERROR_MESSAGES.JSON_PARSE_ERROR}: ${e.message}`);
          }
        }
      }

      const response = await this.executor.execute(apiName, params, domain, authConfig);

      const result = response?.data !== undefined ? response.data : response;
      const requestHeaders = response?.requestHeaders;
      const statusCode = response?.statusCode;
      const statusText = response?.statusText;
      const responseHeaders = response?.responseHeaders;

      await HistoryManager.save(API_TYPES.USER, apiName, params ? [params] : [], result, null, requestHeaders, statusCode, statusText, responseHeaders);
      await HistoryManager.display(API_TYPES.USER, USER_DOM_IDS.HISTORY_LIST, null, { rest: null, js: null, user: this });

    } catch (e) {
      const requestHeaders = e.requestHeaders || null;
      const statusCode = e.statusCode || null;
      const statusText = e.statusText || null;
      const responseHeaders = e.responseHeaders || null;

      let paramsForDisplay = null;
      if (bodyInput && bodyInput.value.trim()) {
        try {
          paramsForDisplay = JSON.parse(bodyInput.value);
        } catch (parseError) {
          // JSONパースエラーの場合は空にする
        }
      }

      await HistoryManager.save(API_TYPES.USER, apiName, paramsForDisplay ? [paramsForDisplay] : [], null, e, requestHeaders, statusCode, statusText, responseHeaders);
      await HistoryManager.display(API_TYPES.USER, USER_DOM_IDS.HISTORY_LIST, null, { rest: null, js: null, user: this });
    }
  }
}
