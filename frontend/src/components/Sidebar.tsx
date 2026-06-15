/**
 * PM Sidebar
 * ============================================================================
 * Navy left sidebar in the same visual language as Benchmark's Sidebar:
 *   - SiteDeck / PM logo block (with orange "PM" line)
 *   - Project selector (collapsible) — used in the PM, not on the Projects
 *     list, but we keep the slot for future cross-project navigation
 *   - Nav items (Top Nav equivalents: Template Library, Portfolio, Billing,
 *     Admin). Active state is tracked by `currentView`.
 *   - ConnectedProducts (separate component, shared)
 *   - User info footer with Sign Out
 *
 * Width: 224px, full-height, sticky. Content is rendered as a flex sibling
 * via the parent layout's flex container.
 */

import { ConnectedProducts, type ConnectedProductsState } from './ConnectedProducts';
import { COLORS, FONTS } from '../styles/design-system';
import { getCurrentRole } from '../auth';

export type SidebarView = 'projects' | 'templates' | 'portfolio' | 'billing' | 'admin';

export interface SidebarUser {
  displayName?: string | null;
  email?: string | null;
}

interface NavItem {
  key: SidebarView;
  label: string;
  icon: string; // simple SVG path
  adminOnly?: boolean;
  show?: boolean; // explicit "this button is enabled" gate
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'projects',
    label: 'Projects',
    icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  },
  {
    key: 'templates',
    label: 'Template Library',
    icon: 'M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2zM9 9h6M9 13h6M9 17h4',
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: 'M3 7h18v12H3zM3 11h18M7 15h4',
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    adminOnly: true,
  },
];

interface Props {
  currentView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  user?: SidebarUser | null;
  onLogout: () => void;
  connectedProducts?: ConnectedProductsState;
  /** When true, hides nav items that are not on Projects (e.g. on a deep view). */
  compact?: boolean;
}

export function Sidebar({
  currentView,
  onNavigate,
  user,
  onLogout,
  connectedProducts,
  compact,
}: Props) {
  const role = getCurrentRole();
  const isAdmin = role === 'owner_admin';

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

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
      {/* Logo */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
          SiteDeck
        </div>
        <div style={{ color: COLORS.orange, fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
          PM
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
          Project Management
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: '16px 12px',
          overflowY: 'auto',
        }}
      >
        {visibleItems.map((item) => {
          const isActive = item.key === currentView;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 6,
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: isActive ? COLORS.white : 'rgba(255,255,255,0.6)',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: 2,
                transition: 'background 0.15s, color 0.15s',
                fontFamily: 'inherit',
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Connected Products */}
      <ConnectedProducts connectedProducts={connectedProducts} compact={compact} />

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
