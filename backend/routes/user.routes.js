const { Router } = require('express');
const { z } = require('zod');
const userController = require('../controllers/user.controller');
const { validateBody } = require('../middlewares/validate.middleware');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// Apply auth middleware uniformly as requested
router.use(verifyAccessToken);

/**
 * @typedef {Object} UpdateProfileDto
 * @property {string} [displayName]
 * @property {string} [bio]
 * @property {string} [avatarUrl]
 * @property {string} [location]
 * @property {string} [timezone]
 */
const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|TRUNCATE)\b|['";])/i;

const noSqlInjection = (val) => {
  if (!val) return true;
  return !sqlInjectionPattern.test(val);
};

const updateProfileSchema = z.object({
  displayName: z.string().refine(noSqlInjection, { message: 'Invalid characters detected' }).optional(),
  bio: z.string().refine(noSqlInjection, { message: 'Invalid characters detected' }).optional(),
  avatarUrl: z.string().url().optional(),
  location: z.string().refine(noSqlInjection, { message: 'Invalid characters detected' }).optional(),
  timezone: z.string().refine(noSqlInjection, { message: 'Invalid characters detected' }).optional()
});

/**
 * @typedef {Object} AddSkillDto
 * @property {string} skillId
 * @property {'offer'|'want'} type
 * @property {'BEGINNER'|'INTERMEDIATE'|'ADVANCED'|'EXPERT'} proficiencyLevel
 * @property {string} [description]
 */
const proficiencyMap = {
  'beginner': 'BEGINNER',
  'intermediate': 'INTERMEDIATE',
  'advanced': 'ADVANCED',
  'expert': 'EXPERT',
};

const addSkillSchema = z.object({
  skillId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  type: z.enum(['offer', 'want', 'OFFER', 'WANT']).transform(v => v.toLowerCase()),
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  proficiency: z.string().optional(),
  description: z.string().optional()
}).transform(data => {
  // Normalize proficiency: accept "proficiency" alias with any casing
  if (!data.proficiencyLevel && data.proficiency) {
    const normalized = data.proficiency.toLowerCase();
    data.proficiencyLevel = proficiencyMap[normalized] || 'INTERMEDIATE';
  }
  if (!data.proficiencyLevel) {
    data.proficiencyLevel = 'INTERMEDIATE';
  }
  delete data.proficiency;
  return data;
}).refine(data => data.skillId || data.name, {
  message: 'Either skillId or name must be provided'
});

/**
 * @typedef {Object} UpdateSkillLevelDto
 * @property {'BEGINNER'|'INTERMEDIATE'|'ADVANCED'|'EXPERT'} proficiencyLevel
 */
const updateSkillLevelSchema = z.object({
  proficiencyLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
});

/**
 * @typedef {Object} AddAvailabilitySlotDto
 * @property {number} dayOfWeek - 0 to 6
 * @property {string} slotStart - DateTime ISO string targeting Time
 * @property {string} slotEnd - DateTime ISO string targeting Time
 * @property {boolean} [isRecurring]
 */
const addAvailabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  slotStart: z.string().datetime(), // Mapping to prisma UTC datetime
  slotEnd: z.string().datetime(), // Mapping to prisma UTC datetime
  isRecurring: z.boolean().default(false)
});

const bulkUpdateAvailabilitySchema = z.object({
  availability: z.record(z.string(), z.array(z.string()))
});

/**
 * @typedef {Object} UpdateNotificationPreferencesDto
 * @property {boolean} [notifyEmail]
 * @property {boolean} [notifyPush]
 * @property {boolean} [notifyInApp]
 */
const updateNotificationPreferencesSchema = z.object({
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

// Search Route (Has to be mapped before /:id)
/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search for users by query
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results returned successfully
 */
router.get('/search', userController.searchUsers);

// Profile Routes
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current logged-in user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               bio:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *               location:
 *                 type: string
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 */
router.get('/me', userController.getOwnProfile);
router.put('/me', validateBody(updateProfileSchema), userController.updateProfile);

/**
 * @swagger
 * /api/users/me/notification-preferences:
 *   put:
 *     summary: Update notification preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifyEmail:
 *                 type: boolean
 *               notifyPush:
 *                 type: boolean
 *               notifyInApp:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.put(
  '/me/notification-preferences',
  validateBody(updateNotificationPreferencesSchema),
  userController.updateNotificationPreferences
);

// Skills Routes
/**
 * @swagger
 * /api/users/me/skills:
 *   post:
 *     summary: Add a skill to the user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [skillId, type, proficiencyLevel]
 *             properties:
 *               skillId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [offer, want]
 *               proficiencyLevel:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Skill added
 *       409:
 *         description: Skill mapping already exists
 */
router.post('/me/skills', validateBody(addSkillSchema), userController.addSkill);

/**
 * @swagger
 * /api/users/me/skills/{id}:
 *   put:
 *     summary: Update a skill level
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [proficiencyLevel]
 *             properties:
 *               proficiencyLevel:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
 *     responses:
 *       200:
 *         description: Skill updated
 *   delete:
 *     summary: Remove a skill from the profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Skill removed
 */
router.put('/me/skills/:id', validateBody(updateSkillLevelSchema), userController.updateSkillLevel);
router.delete('/me/skills/:id', userController.removeSkill);

// Availability Routes
/**
 * @swagger
 * /api/users/me/availability:
 *   post:
 *     summary: Add an availability slot
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dayOfWeek, slotStart, slotEnd]
 *             properties:
 *               dayOfWeek:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               slotStart:
 *                 type: string
 *                 format: date-time
 *               slotEnd:
 *                 type: string
 *                 format: date-time
 *               isRecurring:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Availability slot added
 *       400:
 *         description: Slot cannot span midnight
 *   put:
 *     summary: Bulk update availability
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               availability:
 *                 type: object
 *                 additionalProperties:
 *                   type: array
 *                   items:
 *                     type: string
 *     responses:
 *       200:
 *         description: Availability updated
 */
router.post('/me/availability', validateBody(addAvailabilitySlotSchema), userController.addAvailabilitySlot);
router.put('/me/availability', validateBody(bulkUpdateAvailabilitySchema), userController.bulkUpdateAvailability);

/**
 * @swagger
 * /api/users/me/availability/{id}:
 *   delete:
 *     summary: Remove an availability slot
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability slot removed
 */
router.delete('/me/availability/:id', userController.removeAvailabilitySlot);

// Online presence check
/**
 * @swagger
 * /api/users/{id}/online:
 *   get:
 *     summary: Check if a user is currently online
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Online status
 */
router.get('/:id/online', userController.getOnlineStatus);

// Public Profile Route (Dynamic ID last)
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get public profile of any user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile data
 *       404:
 *         description: User not found
 */
router.get('/:id', userController.getPublicProfile);

module.exports = router;
