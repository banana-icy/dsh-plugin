/**
 * The sidebar's Automations entry, contributed through the official
 * `sidebar.action` slot.
 *
 * The row is the shipped `SidebarRow`, so it matches the built-in New Session
 * control and the global panel rows in both the wide column and the 56px rail;
 * the slot places it, so no observer watches the sidebar DOM. Opening still goes
 * through the conversation view ring, whose Automations tab is the authority for
 * the management UI.
 */
import { useState, type ReactNode } from 'react'
import { SidebarRow, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from './contracts.js'
import { activateAutomationTab } from './navigation.js'

/** Props the sidebar composes for one action row. */
export interface SidebarActionProps {
  /** Shell fold-state: wide renders the label, the rail the glyph alone. */
  readonly wide: boolean
  /** Namespace-bound translate. */
  readonly t: Translate
}

/** The clock glyph the Automations tab uses, at the row's icon size. */
function AutomationGlyph(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.7v4.7l3.15 1.85" />
      <path d="M5.6 4.9 4.2 6.3M18.4 4.9l1.4 1.4" />
    </svg>
  )
}

/**
 * Render the Automations action row.
 * @param props - the sidebar's fold state and the bound translate.
 * @returns the row, plus a status line when the tab is not on screen.
 */
export function SidebarAction({ wide, t }: SidebarActionProps): ReactNode {
  const [unavailable, setUnavailable] = useState(false)
  const open = (): void => {
    const result = activateAutomationTab(
      document.querySelectorAll<HTMLElement>('[role="tab"]'),
      t('tab'),
      () => { setUnavailable(true) },
    )
    if (result === 'opened') setUnavailable(false)
  }
  return (
    <>
      <Tooltip label={t('sidebar.tooltip')} delayMs={500} disabled={wide}>
        <SidebarRow
          icon={<AutomationGlyph />}
          label={t('tab')}
          rail={!wide}
          ariaLabel={t('sidebar.tooltip')}
          onClick={open}
        />
      </Tooltip>
      {unavailable && (
        <span className="dsh-automation-sidebar-notice" role="status">{t('sidebar.unavailable')}</span>
      )}
    </>
  )
}