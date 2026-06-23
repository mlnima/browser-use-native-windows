type PathPoint = { x: number; y: number };

export type MousePathStep = { dx: number; dy: number; delayMs: number };

const clampNumber = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const randomNumberInRange = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const bezierPoint = (a: PathPoint, b: PathPoint, c: PathPoint, d: PathPoint, progress: number) => {
  const inverse = 1 - progress;
  return {
    x: inverse ** 3 * a.x + 3 * inverse ** 2 * progress * b.x + 3 * inverse * progress ** 2 * c.x + progress ** 3 * d.x,
    y: inverse ** 3 * a.y + 3 * inverse ** 2 * progress * b.y + 3 * inverse * progress ** 2 * c.y + progress ** 3 * d.y,
  };
};

export const createHumanMousePath = (dx: number, dy: number): MousePathStep[] => {
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return [];
  const durationMs = clampNumber(Math.round(distance * 2.2), 140, 1600);
  const stepCount = clampNumber(Math.round(durationMs / 13), 8, 48);
  const perpendicular = { x: -dy / distance, y: dx / distance };
  const bend = clampNumber(distance * randomNumberInRange(0.08, 0.22), 8, 180);
  const direction = Math.random() < 0.5 ? -1 : 1;
  const start = { x: 0, y: 0 };
  const end = { x: dx, y: dy };
  const controlA = {
    x: dx * randomNumberInRange(0.2, 0.4) + perpendicular.x * bend * direction,
    y: dy * randomNumberInRange(0.2, 0.4) + perpendicular.y * bend * direction,
  };
  const controlB = {
    x: dx * randomNumberInRange(0.6, 0.85) - perpendicular.x * bend * direction * randomNumberInRange(0.35, 0.9),
    y: dy * randomNumberInRange(0.6, 0.85) - perpendicular.y * bend * direction * randomNumberInRange(0.35, 0.9),
  };
  const points = Array.from({ length: stepCount + 1 }, (_, index) => {
    const progress = index / stepCount;
    const point = bezierPoint(start, controlA, controlB, end, easeInOutCubic(progress));
    const jitter = (1 - progress) * clampNumber(distance * 0.012, 0.15, 2);
    return { x: point.x + randomNumberInRange(-jitter, jitter), y: point.y + randomNumberInRange(-jitter, jitter) };
  });
  points[0] = start;
  points[points.length - 1] = end;
  const steps: MousePathStep[] = [];
  let previous = points[0]!;
  let residualX = 0;
  let residualY = 0;
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]!;
    const rawDx = current.x - previous.x + residualX;
    const rawDy = current.y - previous.y + residualY;
    const roundedDx = Math.round(rawDx);
    const roundedDy = Math.round(rawDy);
    residualX = rawDx - roundedDx;
    residualY = rawDy - roundedDy;
    if (roundedDx !== 0 || roundedDy !== 0) {
      steps.push({ dx: roundedDx, dy: roundedDy, delayMs: Math.round(randomNumberInRange(4, 9)) });
    }
    previous = current;
  }
  const movedDx = steps.reduce((total, step) => total + step.dx, 0);
  const movedDy = steps.reduce((total, step) => total + step.dy, 0);
  const finalDx = Math.round(dx - movedDx);
  const finalDy = Math.round(dy - movedDy);
  if (finalDx !== 0 || finalDy !== 0) {
    steps.push({ dx: finalDx, dy: finalDy, delayMs: Math.round(randomNumberInRange(2, 4.5)) });
  }
  return steps;
};
