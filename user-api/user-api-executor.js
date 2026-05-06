'use strict';

import { TIMING, ERROR_MESSAGES } from '../utils/constants.js';
import { ConfigManager } from '../utils/config-manager.js';

export class UserAPIExecutor {
  constructor(definitionManager) {
    this.definitionManager = definitionManager;
  }

  async execute(apiName, params, domain, authConfig) {
    let method, endpoint;

    const definition = this.definitionManager.getDefinition(apiName);
    if (definition) {
      method = definition.method;
      endpoint = definition.endpoint;
    } else {
      const parts = apiName.split(' ');
      if (parts.length >= 2) {
        method = parts[0];
        endpoint = parts.slice(1).join(' ');
      } else {
        throw new Error(`${ERROR_MESSAGES.API_DEFINITION_NOT_FOUND}: ${apiName}`);
      }
    }

    const authType = authConfig?.authType || 'session';

    if (authType === 'session') {
      const tabId = await ConfigManager.getKintoneTabIdForExecution();

      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      } catch (e) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content-script.js']
          });
          await new Promise(resolve => setTimeout(resolve, TIMING.CONTENT_SCRIPT_INJECT_WAIT));
        } catch (injectError) {
          throw new Error(`${ERROR_MESSAGES.CONTENT_SCRIPT_INJECTION_FAILED}: ${injectError.message}`);
        }
      }

      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'REST_API_EXECUTE',
          apiName,
          method,
          endpoint,
          params,
          domain,
          authConfig,
          tabId
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.error) {
            reject(new Error(response.error));
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(ERROR_MESSAGES.UNEXPECTED_RESPONSE));
          }
        });
      });
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'REST_API_EXECUTE',
        apiName,
        method,
        endpoint,
        params,
        domain,
        authConfig
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(ERROR_MESSAGES.UNEXPECTED_RESPONSE));
        }
      });
    });
  }
}
