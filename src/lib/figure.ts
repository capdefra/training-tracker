export type XY = [number, number];

export interface FigurePose {
  head: XY;
  shoulder: XY;
  hip: XY;
  kneeL: XY;
  footL: XY;
  kneeR: XY;
  footR: XY;
  elbowL: XY;
  handL: XY;
  elbowR: XY;
  handR: XY;
  gear: Array<[XY, XY]>;
}

export function pose(partial: Partial<FigurePose>): FigurePose {
  return {
    head: partial.head ?? [100, 32],
    shoulder: partial.shoulder ?? [100, 52],
    hip: partial.hip ?? [100, 102],
    kneeL: partial.kneeL ?? [88, 148],
    footL: partial.footL ?? [82, 198],
    kneeR: partial.kneeR ?? [112, 148],
    footR: partial.footR ?? [118, 198],
    elbowL: partial.elbowL ?? [78, 78],
    handL: partial.handL ?? [72, 108],
    elbowR: partial.elbowR ?? [122, 78],
    handR: partial.handR ?? [128, 108],
    gear: partial.gear ?? [],
  };
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixPoint(a: XY, b: XY, t: number): XY {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
}

export function lerpPose(start: FigurePose, end: FigurePose, t: number): FigurePose {
  const count = Math.max(start.gear.length, end.gear.length);
  const gear: Array<[XY, XY]> = [];
  for (let index = 0; index < count; index += 1) {
    const left = start.gear[index] ?? end.gear[index] ?? [[0, 0], [0, 0]];
    const right = end.gear[index] ?? start.gear[index] ?? [[0, 0], [0, 0]];
    gear.push([mixPoint(left[0], right[0], t), mixPoint(left[1], right[1], t)]);
  }
  return {
    head: mixPoint(start.head, end.head, t),
    shoulder: mixPoint(start.shoulder, end.shoulder, t),
    hip: mixPoint(start.hip, end.hip, t),
    kneeL: mixPoint(start.kneeL, end.kneeL, t),
    footL: mixPoint(start.footL, end.footL, t),
    kneeR: mixPoint(start.kneeR, end.kneeR, t),
    footR: mixPoint(start.footR, end.footR, t),
    elbowL: mixPoint(start.elbowL, end.elbowL, t),
    handL: mixPoint(start.handL, end.handL, t),
    elbowR: mixPoint(start.elbowR, end.elbowR, t),
    handR: mixPoint(start.handR, end.handR, t),
    gear,
  };
}

export function limbSegments(figure: FigurePose): Array<[XY, XY]> {
  return [
    [figure.shoulder, figure.hip],
    [figure.hip, figure.kneeL],
    [figure.kneeL, figure.footL],
    [figure.hip, figure.kneeR],
    [figure.kneeR, figure.footR],
    [figure.shoulder, figure.elbowL],
    [figure.elbowL, figure.handL],
    [figure.shoulder, figure.elbowR],
    [figure.elbowR, figure.handR],
  ];
}
