export type RuntimeCoordinator = {
  run: <T>(operation: () => Promise<T>) => Promise<T>;
};

export const createRuntimeCoordinator = (): RuntimeCoordinator => {
  let queue = Promise.resolve<unknown>(undefined);
  return {
    run: async <T>(operation: () => Promise<T>) => {
      const active = queue.catch(() => undefined).then(operation);
      queue = active;
      return await active;
    },
  };
};
