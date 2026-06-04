"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVM_METRICS = exports.EVM_THRESHOLDS = void 0;
exports.getEvmStatusColor = getEvmStatusColor;
exports.EVM_THRESHOLDS = {
    SPI_AMBER: 0.9,
    SPI_RED: 0.8,
    CPI_AMBER: 0.9,
    CPI_RED: 0.8,
};
exports.EVM_METRICS = {
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
};
function getEvmStatusColor(metric, value) {
    if (metric === 'spi') {
        if (value < exports.EVM_THRESHOLDS.SPI_RED)
            return 'red';
        if (value < exports.EVM_THRESHOLDS.SPI_AMBER)
            return 'amber';
        return 'green';
    }
    if (metric === 'cpi') {
        if (value < exports.EVM_THRESHOLDS.CPI_RED)
            return 'red';
        if (value < exports.EVM_THRESHOLDS.CPI_AMBER)
            return 'amber';
        return 'green';
    }
    return 'green';
}
//# sourceMappingURL=evm.js.map