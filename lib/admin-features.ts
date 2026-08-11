export const ADMIN_FEATURES = Object.freeze({
  auditAndRegistry: false,
});

const ADMIN_TAB_IDS = [
  'dashboard',
  'loanRequests',
  'transfers',
  'compliance',
  'clients',
  'accounts',
  'balanceAdjustment',
  'documents',
  'reports',
  'support',
  'settings',
] as const;

export type AdminTab = (typeof ADMIN_TAB_IDS)[number];

export function resolveAdminTab(candidate: string): AdminTab {
  if (candidate === 'documents' && !ADMIN_FEATURES.auditAndRegistry) {
    return 'dashboard';
  }

  return (ADMIN_TAB_IDS as readonly string[]).includes(candidate)
    ? (candidate as AdminTab)
    : 'dashboard';
}
