import { Router } from 'express';

const router = Router();

/**
 * Dev login — returns a static dev token and role.
 * In production this route should be disabled or protected.
 */
router.post('/dev-login', (_req, res) => {
  res.json({
    idToken: 'dev-token',
    role: 'project_manager',
  });
});

export default router;
