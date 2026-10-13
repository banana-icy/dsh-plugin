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
import { type ReactNode } from 'react';
import type { Translate } from './contracts.js';
/** Props the sidebar composes for one action row. */
export interface SidebarActionProps {
    /** Shell fold-state: wide renders the label, the rail the glyph alone. */
    readonly wide: boolean;
    /** Namespace-bound translate. */
    readonly t: Translate;
}
/**
 * Render the Automations action row.
 * @param props - the sidebar's fold state and the bound translate.
 * @returns the row, plus a status line when the tab is not on screen.
 */
export declare function SidebarAction({ wide, t }: SidebarActionProps): ReactNode;
