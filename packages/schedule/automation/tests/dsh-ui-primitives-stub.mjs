/**
 * Stand-in for `@deepseek-ai/dsh-client-ui-primitives` in the Node test process.
 *
 * The real package is a browser bundle whose modules import CSS, which plain Node
 * cannot load; the specs here only need the module to resolve and to name the
 * components the plugin imports.
 */
import { createElement } from 'react'

/** The sidebar's quiet row, as a stub element. */
export function SidebarRow(props) {
  return createElement('div', { 'data-stub': 'SidebarRow', ...props })
}

/** The tooltip wrapper, which renders its anchor unchanged. */
export function Tooltip({ children }) {
  return children
}
