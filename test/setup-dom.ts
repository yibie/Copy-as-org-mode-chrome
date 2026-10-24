// Provide browser globals for html2org, which reads `window`/`document` at module load.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
const g = globalThis as any
g.window = dom.window
g.document = dom.window.document
g.DOMParser = dom.window.DOMParser
g.Node = dom.window.Node
g.NodeFilter = dom.window.NodeFilter
