import { Router } from 'express';
import { getPrismaClient } from '../lib/prisma';

const router = Router();

/**
 * Compute connectivity state for the three SiteDeck products.
 * Each field is best-effort: any DB error returns false (the health
 * endpoint must never throw — it's used by load balancers, Uptime
 * checks, and the sidebar status dots).
 *
 * - benchmark: PM_BENCHMARK_WEBHOOK_URL set AND we have at least one
 *   recorded 2xx outbound to Benchmark in the webhook log.
 * - pro: We have received a Pro inbound webhook within the last 7 days.
 * - design: always false (not built).
 */
async function getConnectedProducts(): Promise<{
  benchmark: boolean;
  pro: boolean;
  design: boolean;
}> {
  const result = { benchmark: false, pro: false, design: false };
  try {
    const prisma = getPrismaClient();

    // Benchmark: URL set AND a recorded 2xx outbound
    if (process.env.PM_BENCHMARK_WEBHOOK_URL) {
      const lastBenchmark = await prisma.webhooksLog.findFirst({
        where: {
          event: { contains: 'benchmark' },
          status: { gte: '200', lt: '300' },
        },
        orderBy: { createdAt: 'desc' },
      });
      result.benchmark = Boolean(lastBenchmark);
    }

    // Pro: inbound webhook within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastPro = await prisma.webhooksLog.findFirst({
      where: {
        direction: 'inbound',
        event: { contains: 'pro' },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
    result.pro = Boolean(lastPro);
  } catch (err) {
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

export default router;
