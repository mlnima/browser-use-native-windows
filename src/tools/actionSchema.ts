import * as z from 'zod/v4';

const buttonSchema = z.enum(['left', 'right', 'middle']).optional();

const pointFields = {
  x: z.number(),
  y: z.number(),
};

export const actionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('clickPoint'),
    ...pointFields,
    doubleClick: z.boolean().optional(),
    button: buttonSchema,
    delayMs: z.number().optional(),
  }),
  z.object({
    kind: z.literal('modifierClickPoint'),
    ...pointFields,
    modifiers: z.array(z.string()),
    doubleClick: z.boolean().optional(),
    button: buttonSchema,
    delayMs: z.number().optional(),
  }),
  z.object({ kind: z.literal('contextClickPoint'), ...pointFields, delayMs: z.number().optional() }),
  z.object({ kind: z.literal('middleClickPoint'), ...pointFields, delayMs: z.number().optional() }),
  z.object({ kind: z.literal('movePoint'), ...pointFields }),
  z.object({
    kind: z.literal('dragPoint'),
    startX: z.number(),
    startY: z.number(),
    endX: z.number(),
    endY: z.number(),
    button: buttonSchema,
  }),
  z.object({
    kind: z.literal('typeText'),
    text: z.string(),
    submit: z.boolean().optional(),
    slowly: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('fileDialogUpload'), path: z.string() }),
  z.object({ kind: z.literal('press'), key: z.string(), delayMs: z.number().optional() }),
  z.object({ kind: z.literal('pressCombo'), keys: z.array(z.string()), delayMs: z.number().optional() }),
  z.object({ kind: z.literal('keyDown'), key: z.string() }),
  z.object({ kind: z.literal('keyUp'), key: z.string() }),
  z.object({
    kind: z.literal('scroll'),
    x: z.number().optional(),
    y: z.number().optional(),
    delta: z.number().optional(),
    deltaY: z.number().optional(),
  }),
]);

export type ParsedNativeAction = z.infer<typeof actionSchema>;
