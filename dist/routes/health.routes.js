"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
/**
 * Compute connectivity state for the three SiteDeck products.
 * Each field is best-effort: any DB error returns false (the health
 * endpoint must never throw — it's used by load balancers, Uptime
 * checks, and the sidebar status dots).
 *
 * - benchmark: last inbound benchmark webhook within 7 days OR last
 *   successful outbound to Benchmark within 24h.
 * - pro: We have received a Pro inbound webhook within the last 7 days.
 * - design: always false (not built).
 */
async function getConnectedProducts() {
    const result = { benchmark: false, pro: false, design: false };
    try {
        const prisma = (0, prisma_1.getPrismaClient)();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Inbound benchmark webhook within last 7 days
        const lastInbound = await prisma.webhooksLog.findFirst({
            where: {
                direction: 'inbound',
                event: { contains: 'benchmark' },
                createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Outbound 2xx to Benchmark within last 24h
        const lastOutbound = await prisma.webhooksLog.findFirst({
            where: {
                event: { contains: 'benchmark' },
                status: { gte: '200', lt: '300' },
                createdAt: { gte: twentyFourHoursAgo },
            },
            orderBy: { createdAt: 'desc' },
        });
        result.benchmark = Boolean(lastInbound) || Boolean(lastOutbound);
        // Pro: inbound webhook within last 7 days
        const lastPro = await prisma.webhooksLog.findFirst({
            where: {
                direction: 'inbound',
                event: { contains: 'pro' },
                createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: 'desc' },
        });
        result.pro = Boolean(lastPro);
    }
    catch (err) {
        // Graceful degradation: health must always return a valid shape.
        console.error('[health] getConnectedProducts failed:', err);
    }
    return result;
}
router.get('/', async (_req, res) => {
    const connectedProducts = await getConnectedProducts();
    res.json({
        status: 'ok',
        service: 'sitedeck-pm',
        version: '1.0.0',
        connectedProducts,
    });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map