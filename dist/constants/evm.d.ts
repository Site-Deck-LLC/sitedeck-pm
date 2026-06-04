export declare const EVM_THRESHOLDS: {
    readonly SPI_AMBER: 0.9;
    readonly SPI_RED: 0.8;
    readonly CPI_AMBER: 0.9;
    readonly CPI_RED: 0.8;
};
export declare const EVM_METRICS: {
    readonly BCWS: "BCWS";
    readonly BCWP: "BCWP";
    readonly ACWP: "ACWP";
    readonly SV: "SV";
    readonly CV: "CV";
    readonly SPI: "SPI";
    readonly CPI: "CPI";
    readonly EAC: "EAC";
    readonly VAC: "VAC";
    readonly TCPI: "TCPI";
};
export type EvmMetric = (typeof EVM_METRICS)[keyof typeof EVM_METRICS];
export declare function getEvmStatusColor(metric: 'spi' | 'cpi', value: number): 'green' | 'amber' | 'red';
//# sourceMappingURL=evm.d.ts.map