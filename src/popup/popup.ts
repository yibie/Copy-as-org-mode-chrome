/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { MyMsg_RunPageAction, PAGE_ACTIONS, isScriptableUrl, msgManager } from "../common";

/** Toolbar popup: the context menu's page actions, run on the active tab of this window */
async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const usable = tab?.id !== undefined && isScriptableUrl(tab.url);
  const list = document.getElementById('actions')!;

  for (const action of PAGE_ACTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.title;
    button.disabled = !usable;
    button.addEventListener('click', async () => {
      // Wait for the background's reply: closing first could drop the message
      await msgManager.sendToBg<MyMsg_RunPageAction>({ type: 'runPageAction', action: action.id, tabId: tab.id! });
      window.close();
    });
    const item = document.createElement('li');
    item.append(button);
    list.append(item);
  }
  document.getElementById('hint')!.hidden = usable;

  document.getElementById('open-options')!.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

init();
