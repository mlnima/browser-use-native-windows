export const jsonText = (value: unknown) =>
  JSON.stringify(value, null, 2);

export const textResult = (value: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: typeof value === 'string' ? value : jsonText(value),
    },
  ],
});
