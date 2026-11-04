import { z } from 'zod'

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'suspended', 'done'])
export const taskViewSchema = z.enum(['today', 'all_open', 'in_progress', 'completed', 'suspended'])
export const taskActionSchema = z.enum(['start', 'suspend', 'resume', 'complete', 'restore'])

export const screenshotInputSchema = z
  .object({
    dataUrl: z.string().min(1),
    fileName: z.string().max(255).optional()
  })
  .strict()

export const createTaskInputSchema = z
  .object({
    title: z.string().trim().min(1, '任务名称不能为空').max(200),
    content: z.string().max(20_000).optional(),
    client: z.string().max(160).nullable().optional(),
    notes: z.string().max(10_000).optional(),
    dueDate: z.string().max(20).nullable().optional(),
    dueTime: z.string().max(10).nullable().optional(),
    screenshots: z.array(screenshotInputSchema).max(12).optional()
  })
  .strict()

export const updateTaskInputSchema = z
  .object({
    title: z.string().trim().min(1, '任务名称不能为空').max(200).optional(),
    content: z.string().max(20_000).optional(),
    client: z.string().max(160).nullable().optional(),
    notes: z.string().max(10_000).optional(),
    dueDate: z.string().max(20).nullable().optional(),
    dueTime: z.string().max(10).nullable().optional()
  })
  .strict()

export const taskIdSchema = z.object({
  id: z.string().min(1).max(100)
})

export const transitionTaskSchema = z.object({
  id: z.string().min(1).max(100),
  action: taskActionSchema
})

export const addScreenshotSchema = z.object({
  taskId: z.string().min(1).max(100),
  dataUrl: z.string().min(1),
  fileName: z.string().max(255).optional()
})

export const screenshotIdSchema = z.object({
  id: z.string().min(1).max(100)
})

export const aiExtractInputSchema = z
  .object({
    imageDataUrls: z.array(z.string().min(1)).min(1).max(12)
  })
  .strict()

export const aiExtractionSchema = z
  .object({
    title: z.string().optional().catch(''),
    content: z.string().optional().catch(''),
    client: z.string().nullable().optional().catch(null),
    dueDate: z.string().nullable().optional().catch(null),
    dueTime: z.string().nullable().optional().catch(null),
    notes: z.string().optional().catch(''),
    confidence: z.number().nullable().optional().catch(null)
  })
  .passthrough()

export const settingsPatchSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    autostart: z.boolean().optional(),
    notifications: z
      .object({
        enabled: z.boolean().optional(),
        morningTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        dailySummary: z.boolean().optional(),
        dueTimeReminders: z.boolean().optional()
      })
      .strict()
      .optional(),
    ball: z
      .object({
        visible: z.boolean().optional(),
        x: z.number().int().nullable().optional(),
        y: z.number().int().nullable().optional(),
        size: z.number().int().min(56).max(120).optional(),
        dock: z.enum(['none', 'left', 'right', 'top', 'bottom']).optional()
      })
      .strict()
      .optional(),
    window: z
      .object({
        width: z.number().int().min(800).max(4000).optional(),
        height: z.number().int().min(600).max(3000).optional(),
        x: z.number().int().nullable().optional(),
        y: z.number().int().nullable().optional()
      })
      .strict()
      .optional(),
    ai: z
      .object({
        provider: z.enum(['opencode-go', 'custom']).optional(),
        baseUrl: z.string().url().max(500).optional(),
        model: z.string().trim().min(1).max(200).optional()
      })
      .strict()
      .optional(),
    onboardingCompleted: z.boolean().optional()
  })
  .strict()

export const apiKeySchema = z.object({
  key: z.string().max(1000)
})

export const ballExpandedSchema = z.object({
  expanded: z.boolean()
})

export const testNotificationSchema = z.object({}).strict()
