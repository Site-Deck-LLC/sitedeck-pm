/**
 * Onboarding & Training Coach Agent
 * ============================================================================
 * Role: Contextual help and guided onboarding driven by the live state of a
 *   project. Surfaces tooltips, checklists, and training nudges based on
 *   what the user is currently looking at and what they have not yet completed.
 *
 * Data consumed:
 *   - Project setup state (project.service.ts, project-setup.service.ts)
 *   - Dashboard health tiles (dashboard.service.ts) — identifies gaps
 *   - Schedule module status (schedule.service.ts) — missing baselines, etc.
 *   - Cost module status (cost.service.ts) — missing budget lines, EVM
 *   - Scope module status (scope.service.ts) — missing scope statements
 *   - Communications module status (communications.service.ts) — open RFIs
 *   - Current user's role and permissions (auth.service.ts)
 *
 * Outputs:
 *   - Contextual tip cards with next-best-action recommendations
 *   - Onboarding checklist progress for the current user role
 *   - Training nudges (e.g., "You haven't created a baseline yet — here's how")
 *
 * TODO(21dev.agentbuilder): Implement role-based context engine, progressive
 *   disclosure logic, and help-content recommendation system.
 */

import { getProjectById } from '../services/project.service';
import { runProjectSetup } from '../services/project-setup.service';
import { getMorningDashboard } from '../services/dashboard.service';
import {
  calculateBaselineVariance,
  getSchedulePerformance,
} from '../services/schedule.service';
import {
  getBudgetLinesByProject,
  calculateProjectEvm,
} from '../services/cost.service';
import { getScopeStatementsByProject } from '../services/scope.service';
import { getRfiByProject } from '../services/communications.service';
import { getUserRole } from '../services/auth.service';

export interface CoachInput {
  projectId: string;
  userId: string;
  currentView: string; // e.g., 'dashboard', 'schedule', 'cost', 'scope'
  actionJustCompleted?: string;
}

export interface TipCard {
  priority: number;
  title: string;
  body: string;
  ctaLabel: string;
  ctaLink: string;
  dismissible: boolean;
}

export interface OnboardingProgress {
  role: string;
  totalSteps: number;
  completedSteps: number;
  nextStep: { label: string; link: string } | null;
}

export interface CoachOutput {
  tips: TipCard[];
  onboarding: OnboardingProgress;
  nudges: string[];
}

export async function runCoach(input: CoachInput): Promise<CoachOutput> {
  // TODO(21dev.agentbuilder): Replace with real coaching inference engine.
  return {
    tips: [],
    onboarding: {
      role: 'unknown',
      totalSteps: 0,
      completedSteps: 0,
      nextStep: null,
    },
    nudges: [],
  };
}
