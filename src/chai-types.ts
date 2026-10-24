/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * The chai highlight types offered in the Reader View. chai itself reads any
 * type name, so this list is only what the menu shows and how marks are
 * colored; it is kept by the user on the Options page.
 */

export interface ChaiType {
    name: string
    /** Highlight background, `#rrggbb` */
    color: string
}

/** chai's built-in `chai-highlight-types`, colored like its light-theme faces. */
// The user's chai palette (nova-emacs `chai-highlight-types`); colors are chai's
// light faces, and fact inherits question's blue
export const DEFAULT_CHAI_TYPES: ChaiType[] = [
    { name: 'key', color: '#ffe082' },
    { name: 'idea', color: '#b2dfdb' },
    { name: 'question', color: '#bbdefb' },
    { name: 'fact', color: '#bbdefb' },
]

const NAME_RE = /^[A-Za-z0-9_-]+$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function isValidChaiTypeName(name: string): boolean {
    return NAME_RE.test(name)
}

/**
 * Problem with a type list, or null when it can be saved.
 * Names must be valid and unique; colors must be `#rrggbb`.
 */
export function chaiTypesError(types: ChaiType[]): string | null {
    const seen = new Set<string>()
    for (const t of types) {
        if (!isValidChaiTypeName(t.name)) { return `Invalid type name: "${t.name}"` }
        if (seen.has(t.name)) { return `Duplicate type name: "${t.name}"` }
        if (!COLOR_RE.test(t.color)) { return `Invalid color for "${t.name}": "${t.color}"` }
        seen.add(t.name)
    }
    return null
}

/** Repair a stored value: defaults when it is not a list, otherwise drop bad or repeated entries. */
export function normalizeChaiTypes(value: unknown): ChaiType[] {
    if (!Array.isArray(value)) { return DEFAULT_CHAI_TYPES.map(t => ({ ...t })) }
    const out: ChaiType[] = []
    for (const v of value) {
        if (!v || typeof v.name !== 'string' || typeof v.color !== 'string') { continue }
        const t = { name: v.name, color: v.color.toLowerCase() }
        if (chaiTypesError([...out, t]) === null) { out.push(t) }
    }
    return out
}
