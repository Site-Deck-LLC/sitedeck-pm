/**
 * Project Sidebar
 * ============================================================================
 * 224px navy left rail used inside a project (Dashboard, Gantt, RFI, etc.).
 * Same visual language as the cross-app PM Sidebar (logo block, navy bg,
 * Connected Products, user footer) but the nav is the per-project icon set
 * (Schedule, RFI, Comm, Meetings, etc.) rather than the cross-app menu.
 *
 * The Dashboard hands us its `navItems` array and `activeNav` state, plus
 * a `headerSlot` (the project name + switcher button) to render in the
 * top block. Everything else (connected products, user, sign-out) is
 * shared with the PM Sidebar.
 */

import type { ReactNode, ReactElement } from 'react';
import { cloneElement, isValidElement } from 'react';
import { ConnectedProducts, type ConnectedProductsState } from './ConnectedProducts';
import { COLORS, FONTS } from '../styles/design-system';
import { getCurrentRole } from '../auth';
import type { SidebarUser } from './Sidebar';

export interface ProjectNavItem {
  key: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  navItems: ProjectNavItem[];
  activeNav: string;
  onSelectKey: (key: string) => void;
  headerSlot: ReactNode;
  user?: SidebarUser | null;
  onLogout: () => void;
  connectedProducts?: ConnectedProductsState;
}

/**
 * Resize an SVG icon (passed from outside) to the sidebar's 16px slot.
 * The Dashboard's nav icons are authored at 20px (used elsewhere in the
 * dashboard content); cloneElement overrides the width/height so they
 * fit the Benchmark-pattern rail without re-authoring the icon set.
 */
function resizeIcon(icon: ReactNode, size: number): ReactNode {
  if (!isValidElement(icon)) return icon;
  const el = icon as ReactElement<{ width?: number | string; height?: number | string }>;
  return cloneElement(el, { width: size, height: size });
}

export function ProjectSidebar({
  navItems,
  activeNav,
  onSelectKey,
  headerSlot,
  user,
  onLogout,
  connectedProducts,
}: Props) {
  // `getCurrentRole` is imported to make admin nav items easy to add in
  // a future iteration. Not gating anything today (Dashboard nav doesn't
  // have admin items), but the import signals the seam.
  void getCurrentRole;

  return (
    <aside
      style={{
        width: 224,
        flexShrink: 0,
        background: COLORS.navy,
        color: COLORS.white,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        fontFamily: FONTS.family,
      }}
    >
      {/* Project context block (project name + switcher) */}
      {headerSlot}

      {/* Icon+label nav (Benchmark pattern) */}
      <nav
        style={{
          flex: 1,
          padding: '12px 8px',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <button
                key={item.key}
                onClick={() => onSelectKey(item.key)}
                title={item.label}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? COLORS.white : 'rgba(255,255,255,0.6)',
                  transition: 'background 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = COLORS.white;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                  }
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {resizeIcon(item.icon, 16)}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Connected Products */}
      <ConnectedProducts connectedProducts={connectedProducts} />

      {/* User info footer */}
      <div
        style={{
          padding: '12px 16px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: COLORS.white,
              fontSize: 12,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.displayName || user?.email || 'User'}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email || ''}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 8,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.white)}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
