import * as z from 'zod/v4';
import { browserActionDescription, browserKeyDescription, browserScreenshotXDescription, browserScreenshotYDescription } from '../prompts/browserUse';

const actionKinds = [
  'moveNode',
  'movePoint',
  'clickCurrentPointer',
  'dragFromCurrentPointer',
  'typeText',
  'fileDialogUpload',
  'press',
  'pressCombo',
  'keyDown',
  'keyUp',
  'scrollCurrentPointer',
] as const;

const requiredFields: Record<string, string[]> = {
  moveNode: ['nodeId'],
  movePoint: ['x', 'y'],
  clickCurrentPointer: ['pointerVerificationToken'],
  dragFromCurrentPointer: ['pointerVerificationToken', 'endX', 'endY'],
  typeText: ['text'],
  fileDialogUpload: ['path'],
  press: ['key'],
  pressCombo: ['keys'],
  keyDown: ['key'],
  keyUp: ['key'],
  scrollCurrentPointer: ['pointerVerificationToken', 'direction'],
};

export const actionSchema = z.object({
  kind: z.enum(actionKinds).describe(browserActionDescription),
  nodeId: z.string().optional(),
  x: z.number().optional().describe(browserScreenshotXDescription),
  y: z.number().optional().describe(browserScreenshotYDescription),
  endX: z.number().optional(),
  endY: z.number().optional(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  modifiers: z.array(z.string()).optional().describe(browserKeyDescription),
  pointerVerificationToken: z.string().optional(),
  text: z.string().optional(),
  submit: z.boolean().optional(),
  slowly: z.boolean().optional(),
  path: z.string().optional(),
  key: z.string().optional().describe(browserKeyDescription),
  keys: z.array(z.string()).optional().describe(browserKeyDescription),
  delayMs: z.number().optional(),
  direction: z.enum(['up', 'down']).optional(),
  steps: z.number().optional(),
}).superRefine((action, context) => {
  const record = action as Record<string, unknown>;
  for (const field of requiredFields[action.kind] || []) {
    if (record[field] !== undefined) continue;
    context.addIssue({ code: 'custom', path: [field], message: `${field} is required for ${action.kind}.` });
  }
});

export type ParsedNativeAction = z.infer<typeof actionSchema>;
