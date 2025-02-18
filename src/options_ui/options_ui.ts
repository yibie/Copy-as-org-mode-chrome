/*!
 * Copyright (c) 2021 ono ono (kuanyui) All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * You may not remove or alter the substance of any license notices (including
 * copyright notices, patent notices, disclaimers of warranty, or limitations of
 * liability) contained within the Source Code Form of the Covered Software,
 * except that You may alter any license notices to the extent required to
 * remedy known factual inaccuracies. (Cited from MPL - 2.0, chapter 3.3)
 */

import { storageManager } from "../options"
import { initSyntaxhlElements } from "../syntaxhl/syntaxhl"
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

function q<T extends HTMLElement>(elementId: string): T {
    const el = document.getElementById(elementId)
    if (!el) { throw new TypeError(`[To Developer] The element id ${elementId} is not found`) }
    return el as T
}

function getSelectValue(id: string): string {
    return q<HTMLSelectElement>(id).value
}
function setSelectValue(id: string, value: string) {
    q<HTMLSelectElement>(id).value = value
}
function getRadioValue(radioGroupName: string): string {
    const radioList = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${radioGroupName}"]`))
    for (const radio of radioList) {
        if (radio.checked) {
            return radio.value
        }
    }
    return ''
}
function setRadioValue(radioGroupName: string, value: string) {
    const radioList = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${radioGroupName}"]`))
    for (const radio of radioList) {
        if (radio.value === value) {
            radio.checked = true
            return
        }
    }
}
function getCheckboxValue(id: string): boolean {
    return q<HTMLInputElement>(id).checked
}
function setCheckboxValue(id: string, checked: boolean) {
    q<HTMLInputElement>(id).checked = checked
}
function getTextAreaValue(id: string): string {
    return q<HTMLTextAreaElement>(id).value
}
function setTextAreaValue(id: string, value: string) {
    q<HTMLTextAreaElement>(id).value = value
}
function getContentEditableValue(id: string): string {
    let node = q<HTMLDivElement>(id)
    const plaintext = nodeToText(node)
    return plaintext
}
function setContentEditableValue(id: string, value: string) {
    q<HTMLDivElement>(id).innerText = value
}

/**
 * Yet another workaround for the fucking stupid DOM API.
 * For Firefox only. Not tested on Chromium.
 */
function nodeToText(node: Node): string {
    let str = ''
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i]
        if (child.nodeType === Node.TEXT_NODE) {
            str += child.textContent
            continue
        } else if (child.nodeName === 'BR') {
            if (i !== node.childNodes.length - 1) {
                str += '\n'
            }
            continue
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            str += nodeToText(child)
            if (child.nodeName === 'DIV') {
                str += '\n'
            }
            continue
        }
    }
    return str
}


async function loadFromLocalStorage() {
    const d = await storageManager.getData()
    setSelectValue('listIndentSize', d.listIndentSize + '')
    setSelectValue('ulBulletChar', d.ulBulletChar)
    setSelectValue('olBulletChar', d.olBulletChar)
    setSelectValue('codeChar', d.codeChar)
    setRadioValue('codeBlockStyle', d.codeBlockStyle)
    setCheckboxValue('insertReferenceLink_enabled', d.insertReferenceLink.enabled)
    setSelectValue('insertReferenceLink_pos', d.insertReferenceLink.pos)
    setContentEditableValue('insertReferenceLink_format', d.insertReferenceLink.format)
    setRadioValue('notificationMethod', d.notificationMethod)
    setRadioValue('rubyHandleMethod', d.rubyHandleMethod)
    setCheckboxValue('decodeUri', d.decodeUri)
    setSelectValue('squareBracketsInLink', d.squareBracketsInLink)

}

async function resetToDefault() {
    storageManager.setDataPartially(storageManager.getDefaultData())
    await loadFromLocalStorage()
}
q<HTMLButtonElement>('resetBtn').onclick = resetToDefault

async function saveFormToLocalStorage() {
    storageManager.setDataPartially({
        listIndentSize: ~~getSelectValue('listIndentSize'),
        ulBulletChar: getSelectValue('ulBulletChar') as any,
        olBulletChar: getSelectValue('olBulletChar') as any,
        codeChar: getSelectValue('codeChar') as any,
        codeBlockStyle: getRadioValue('codeBlockStyle') as any,
        insertReferenceLink: {
            enabled: getCheckboxValue('insertReferenceLink_enabled'),
            pos: getSelectValue('insertReferenceLink_pos') as any,
            format: getContentEditableValue('insertReferenceLink_format') as any,
        },
        notificationMethod: getRadioValue('notificationMethod') as any,
        rubyHandleMethod: getRadioValue('rubyHandleMethod') as any,
        decodeUri: getCheckboxValue('decodeUri'),
        squareBracketsInLink: getSelectValue('squareBracketsInLink') as any,
    })
}


function watchForm() {
    const form = document.querySelector('form')!
    form.addEventListener('change', (ev) => {
        console.log(ev)
        saveFormToLocalStorage()
    })
    const contentEditableElArr = document.querySelectorAll(".syntaxhl-editor")
    contentEditableElArr.forEach((el: Element) => {
        el.addEventListener('input', (ev) => {
            console.log('contentEditableChanged', ev)
            saveFormToLocalStorage()
        })
    })
}

function newElem(tag: string, innerText: string) {
    const el = document.createElement(tag)
    el.innerText = innerText
    return el
}

function postProcessUi() {
    const obj: string = ["r", "to", "ga", "vi", "na"].reverse().join('')
    const key: string = ["s", "ge", "ua", "ng", "la"].reverse().join('')
    const lst: string[] = 'kh nc gs shc'.split('').reverse().join('').toUpperCase().split(' ')
    // @ts-expect-error
    let arr: string[] = window[obj][key]
    if (arr.some(token => lst.some(voi => token.includes(voi))) || arr.every(x => x.startsWith('en'))) {
        const root = document.createElement('span')
        root.appendChild(newElem('span', '(For example, replace '))
        root.appendChild(newElem('code', "%E6%9E%97%E6%AA%8E"))
        root.appendChild(newElem('span', ' in URI with '))
        root.appendChild(newElem('code', "林檎"))
        root.appendChild(newElem('span', ')'))
        document.querySelector('#decodeUriExample')!.after(root)
        return
    }
    const root = document.createElement('span')
    const exampleUri = "%E3%81%82%E3%82%8A%E3%81%8C%E3%81%A8%E3%81%86%E6%97%A5%E6%9C%AC"
    root.appendChild(newElem('span', '(For example, '))
    root.appendChild(newElem('code', exampleUri))
    root.appendChild(newElem('span', ' will be converted to '))
    root.appendChild(newElem('code', decodeURI(exampleUri)))
    root.appendChild(newElem('span', ')'))
    const mountPoint = document.querySelector('#decodeUriExample')!
    mountPoint.after(root)
    mountPoint.remove()
    const title: string = decodeURI("%20%F0%9F%87%B9%F0%9F%87%BC%20%E5%8F%B0%E6%B9%BE%E3%81%8B%E3%82%89%E3%81%AE%E6%84%9F%E8%AC%9D%EF%BC%9A%E6%97%A5%E6%9C%AC%20%F0%9F%87%AF%F0%9F%87%B5%20%E3%81%AF%E3%83%AF%E3%82%AF%E3%83%81%E3%83%B3%E3%82%92%E6%8F%90%E4%BE%9B%E3%81%84%E3%81%9F%E3%81%A0%E3%81%8D%E3%80%81%E5%BF%83%E3%82%88%E3%82%8A%E6%84%9F%E8%AC%9D%E3%82%92%E7%94%B3%E3%81%97%E4%B8%8A%E3%81%92%E3%81%BE%E3%81%99%EF%BC%81%20%F0%9F%87%BA%F0%9F%87%B8%20%F0%9F%87%B1%F0%9F%87%B9%20%F0%9F%87%A8%F0%9F%87%BF%20%F0%9F%87%B8%F0%9F%87%B0%20%E3%81%AB%E3%82%82%EF%BC%81")
    const labelEl = document.querySelector('#decodeUri')!.parentElement!
    labelEl.className = 'label-highlight'
    labelEl.title = title
}

function installTippy() {
    document.querySelectorAll('[title]').forEach(el => {
        const msg = el.getAttribute('title')!
        el.removeAttribute('title')
        el.setAttribute('data-tippy-content', msg)
    })
    tippy('[data-tippy-content]')
}

async function main() {
    postProcessUi()
    installTippy()
    await loadFromLocalStorage()
    watchForm()
    initSyntaxhlElements()
}

main()