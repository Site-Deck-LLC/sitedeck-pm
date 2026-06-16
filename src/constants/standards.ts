/**
 * Compliance Standards Constants
 * ============================================================================
 * Static catalog of the construction standards and clauses the compliance
 * agent checks. Each entry maps a stable id to a human-readable name, the
 * rule clause (or code section), and the data source the rule needs.
 *
 * This is intentionally a stub catalog — V1 covers the most common checks
 * found on industrial / commercial jobs. New standards are added by
 * appending an entry here AND adding a corresponding check function in
 * standards.agent.ts.
 *
 * A real production system would also have a jurisdiction map (which
 * standards apply in which county/state) and a contract-clause map (each
 * project knows which contract clauses to check). Both are future tasks.
 * ============================================================================
 */

export type StandardCategory = 'osha' | 'nfpa' | 'nec' | 'contract' | 'permit' | 'environmental';

export interface StandardDefinition {
  id: string;
  category: StandardCategory;
  /** Human-readable short name */
  name: string;
  /** Code section / clause identifier (e.g. "1926.501(b)(1)") */
  clause: string;
  /** One-sentence description of what the rule covers */
  description: string;
  /** Where to find the data the check needs */
  dataSource: string;
  /** Default cadence — the rule may be required on every project, or only
   *  those with a specific scope flag (e.g. battery storage). */
  appliesTo: 'all' | 'scope:energy_storage' | 'scope:high_rise' | 'scope:public_work';
}

export const STANDARDS_CATALOG: readonly StandardDefinition[] = [
  // ── OSHA — most projects ────────────────────────────────────────────────────
  { id: 'OSHA_1926_501', category: 'osha', name: 'Fall Protection', clause: '29 CFR 1926.501(b)(1)',
    description: 'Fall protection required at heights of 6 feet or more in construction.',
    dataSource: 'safety.incidents', appliesTo: 'all' },
  { id: 'OSHA_1926_451', category: 'osha', name: 'Scaffolding Safety', clause: '29 CFR 1926.451',
    description: 'Scaffolds and scaffold components must support their own weight plus 4x intended load.',
    dataSource: 'safety.observations', appliesTo: 'all' },
  { id: 'OSHA_1926_95', category: 'osha', name: 'PPE — Hard Hats', clause: '29 CFR 1926.95',
    description: 'Personal protective equipment (hard hats) required in active work zones.',
    dataSource: 'safety.observations', appliesTo: 'all' },
  { id: 'OSHA_1903', category: 'osha', name: 'Injury Reporting', clause: '29 CFR 1903',
    description: 'Fatalities within 8 hours; in-patient hospitalizations, amputations, eye loss within 24 hours.',
    dataSource: 'safety.incidents', appliesTo: 'all' },

  // ── NFPA ───────────────────────────────────────────────────────────────────
  { id: 'NFPA_855', category: 'nfpa', name: 'Energy Storage System Installation', clause: 'NFPA 855 (2023) Ch. 4',
    description: 'Spacing, fire suppression, and explosion control for stationary battery storage.',
    dataSource: 'scope.battery_storage + safety', appliesTo: 'scope:energy_storage' },
  { id: 'NFPA_241', category: 'nfpa', name: 'Construction/Alteration Fire Safety', clause: 'NFPA 241 (2018)',
    description: 'Fire safety program for new construction and major alterations; impairment handling for existing systems.',
    dataSource: 'safety.fire_impairment', appliesTo: 'all' },

  // ── NEC ────────────────────────────────────────────────────────────────────
  { id: 'NEC_706', category: 'nec', name: 'Energy Storage Systems', clause: 'NEC 706',
    description: 'Listed equipment, overcurrent protection, and disconnecting means for ESS.',
    dataSource: 'procurement.ess_equipment', appliesTo: 'scope:energy_storage' },

  // ── Contract / notice ──────────────────────────────────────────────────────
  { id: 'CONTRACT_NOTICE_48H', category: 'contract', name: '48-Hour Inspection Notice', clause: 'Standard AIA G702/703',
    description: 'Notice to architect/owner required 48 hours before covered work reaches an inspection hold.',
    dataSource: 'schedule.activities_with_inspection_holds', appliesTo: 'all' },
  { id: 'CONTRACT_SWPP', category: 'contract', name: 'Stormwater Pollution Prevention', clause: 'EPA NPDES + state',
    description: 'SWPPP inspections every 7 days and after qualifying rain events during construction.',
    dataSource: 'safety.environmental_inspections', appliesTo: 'scope:public_work' },

  // ── Permit ─────────────────────────────────────────────────────────────────
  { id: 'PERMIT_BUILDING', category: 'permit', name: 'Building Permit — Active', clause: 'Local jurisdiction',
    description: 'Building permit must be active and posted on site through project closeout.',
    dataSource: 'project.permits', appliesTo: 'all' },
  { id: 'PERMIT_FIRE', category: 'permit', name: 'Fire System Permit', clause: 'Local fire marshal',
    description: 'Separate permit required for fire suppression / alarm work; tie-in tests witnessed.',
    dataSource: 'project.permits', appliesTo: 'all' },

  // ── Environmental ──────────────────────────────────────────────────────────
  { id: 'ENV_HAZMAT_LDS', category: 'environmental', name: 'Hazardous Material Handling', clause: '29 CFR 1926.62 (Lead) + state',
    description: 'Lead / asbestos / silica exposure controls and training records.',
    dataSource: 'safety.hazmat_observations', appliesTo: 'all' },
] as const;

const STANDARDS_BY_ID: Record<string, StandardDefinition> = STANDARDS_CATALOG.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, StandardDefinition>
);

export function getStandard(id: string): StandardDefinition | null {
  return STANDARDS_BY_ID[id] || null;
}

export function listStandards(): readonly StandardDefinition[] {
  return STANDARDS_CATALOG;
}
