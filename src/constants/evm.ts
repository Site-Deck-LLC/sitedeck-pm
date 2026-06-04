export const EVM_THRESHOLDS = {
  SPI_AMBER: 0.9,
  SPI_RED: 0.8,
  CPI_AMBER: 0.9,
  CPI_RED: 0.8,
} as const;

export const EVM_METRICS = {
  BCWS: 'BCWS',
  BCWP: 'BCWP',
  ACWP: 'ACWP',
  SV: 'SV',
  CV: 'CV',
  SPI: 'SPI',
  CPI: 'CPI',
  EAC: 'EAC',
  VAC: 'VAC',
  TCPI: 'TCPI',
} as const;

export type EvmMetric = (typeof EVM_METRICS)[keyof typeof EVM_METRICS];

export function getEvmStatusColor(
  metric: 'spi' | 'cpi',
  value: number
): 'green' | 'amber' | 'red' {
  if (metric === 'spi') {
    if (value < EVM_THRESHOLDS.SPI_RED) return 'red';
    if (value < EVM_THRESHOLDS.SPI_AMBER) return 'amber';
    return 'green';
  }

  if (metric === 'cpi') {
    if (value < EVM_THRESHOLDS.CPI_RED) return 'red';
    if (value < EVM_THRESHOLDS.CPI_AMBER) return 'amber';
    return 'green';
  }

  return 'green';
}
