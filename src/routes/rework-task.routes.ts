import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/express-auth';
import { ROLES } from '../constants/roles';
import { asyncHandler } from '../lib/async-handler';
import {
  createReworkTask,
  listReworkTasks,
  getReworkTask,
  updateReworkTaskStatus,
  assignReworkTask,
  ReworkTaskStatus,
  ReworkTaskSource,
} from '../services/rework-task.service';

const REWORK_TASK_MANAGER_ROLES = [
  ROLES.OWNER_ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.SUPERINTENDENT,
  ROLES.SUPERVISOR,
];

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const tasks = await listReworkTasks(projectId);
    res.json({ tasks });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(...REWORK_TASK_MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const {
      dfowId,
      inspectionRecordId,
      ncrId,
      source = 'manual',
      sourceEventId,
      title,
      description,
      status,
      priority,
      assignedTo,
      dueDate,
    } = req.body;

    const task = await createReworkTask({
      projectId,
      dfowId,
      inspectionRecordId,
      ncrId,
      source: source as ReworkTaskSource,
      sourceEventId,
      title,
      description,
      status: status as ReworkTaskStatus | undefined,
      priority,
      assignedTo,
      dueDate,
      createdBy: req.user?.uid || 'unknown',
    });

    res.status(201).json({ task });
  })
);

router.patch(
  '/:id/status',
  requireAuth,
  requireRole(...REWORK_TASK_MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const task = await updateReworkTaskStatus(id, status as ReworkTaskStatus, req.user?.uid || 'unknown');
    res.json({ task });
  })
);

router.patch(
  '/:id/assign',
  requireAuth,
  requireRole(...REWORK_TASK_MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const task = await assignReworkTask(id, assignedTo as string, req.user?.uid || 'unknown');
    res.json({ task });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await getReworkTask(id);
    if (!task) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rework task not found' } });
      return;
    }
    res.json({ task });
  })
);

export default router;
