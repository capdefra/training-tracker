import { pose, type FigurePose } from './figure';
import { exerciseKey } from './stats';

export interface ExerciseDemo {
  name: string;
  phases: [string, string];
  start: FigurePose;
  end: FigurePose;
  cues: string[];
  watch: string;
}

const bar = (y: number, x1 = 68, x2 = 132): FigurePose['gear'] => [[[x1, y], [x2, y]]];

const step: FigurePose['gear'] = [
  [[70, 186], [150, 186]],
  [[70, 186], [70, 200]],
  [[150, 186], [150, 200]],
];

const bench: FigurePose['gear'] = [
  [[28, 150], [78, 150]],
  [[28, 150], [28, 176]],
  [[78, 150], [78, 176]],
];

const box: FigurePose['gear'] = [
  [[64, 146], [156, 146]],
  [[64, 146], [64, 200]],
  [[156, 146], [156, 200]],
];

const thrustBench: FigurePose['gear'] = [
  [[24, 132], [86, 132]],
  [[24, 132], [24, 168]],
  [[86, 132], [86, 168]],
];

const anchor: FigurePose['gear'] = [
  [[36, 190], [92, 190]],
  [[36, 190], [36, 200]],
];

const DEMOS: ExerciseDemo[] = [
  {
    name: 'Back squat',
    phases: ['Stand', 'Bottom'],
    start: pose({
      elbowL: [70, 62],
      handL: [78, 48],
      elbowR: [130, 62],
      handR: [122, 48],
      gear: bar(46),
    }),
    end: pose({
      head: [78, 62],
      shoulder: [84, 80],
      hip: [62, 118],
      kneeL: [50, 138],
      footL: [44, 198],
      kneeR: [112, 132],
      footR: [128, 198],
      elbowL: [58, 84],
      handL: [70, 66],
      elbowR: [114, 74],
      handR: [106, 60],
      gear: bar(62, 62, 118),
    }),
    cues: [
      'Bar on the upper back, feet about shoulder width, brace before you move.',
      'Sit the hips back and down until the thighs are at least parallel. Knees track over the toes.',
      'Drive through the middle of the foot to stand. The target is 5 sets of 5.',
    ],
    watch: 'Keep the chest tall. If the heels lift or the knees cave, reduce the depth before you add load.',
  },
  {
    name: 'Romanian deadlift',
    phases: ['Stand', 'Hinge'],
    start: pose({
      elbowL: [90, 96],
      handL: [90, 122],
      elbowR: [112, 96],
      handR: [112, 122],
      gear: bar(124, 84, 118),
    }),
    end: pose({
      head: [42, 86],
      shoulder: [56, 100],
      hip: [108, 112],
      kneeL: [112, 146],
      footL: [104, 198],
      kneeR: [128, 146],
      footR: [132, 198],
      elbowL: [70, 132],
      handL: [74, 158],
      elbowR: [86, 136],
      handR: [90, 162],
      gear: bar(164, 68, 108),
    }),
    cues: [
      'Soft knees, bar close to the legs, and a flat back.',
      'Push the hips back until the hamstrings load. The bar stays against the legs.',
      'Squeeze the glutes to stand. The target is 3 sets of 8.',
    ],
    watch: 'Stop the hinge when the back wants to round. This is not a squat.',
  },
  {
    name: 'Walking lunge',
    phases: ['Stand', 'Lunge'],
    start: pose({}),
    end: pose({
      head: [96, 46],
      shoulder: [100, 66],
      hip: [104, 118],
      kneeL: [64, 168],
      footL: [40, 198],
      kneeR: [138, 150],
      footR: [158, 198],
      elbowL: [82, 88],
      handL: [74, 112],
      elbowR: [122, 86],
      handR: [130, 108],
    }),
    cues: [
      'Step forward and lower the back knee toward the floor.',
      'Front knee stays over the ankle. Push through the front heel to stand.',
      'Alternate legs. Log 8 reps per set, counting each leg.',
    ],
    watch: 'A short step throws the knee past the toes. Take a long enough step that the shin stays roughly vertical.',
  },
  {
    name: 'Calf raise',
    phases: ['Stretch', 'Rise'],
    start: pose({
      kneeL: [90, 160],
      footL: [86, 184],
      kneeR: [116, 160],
      footR: [122, 184],
      gear: step,
    }),
    end: pose({
      head: [100, 16],
      shoulder: [100, 36],
      hip: [100, 86],
      kneeL: [90, 144],
      footL: [86, 184],
      kneeR: [116, 144],
      footR: [122, 184],
      elbowL: [76, 60],
      handL: [70, 84],
      elbowR: [124, 60],
      handR: [130, 84],
      gear: step,
    }),
    cues: [
      'Balls of the feet on a step, heels hanging, a rail nearby for balance.',
      'Rise as high as you can and pause.',
      'Lower the heels below the step with control. The target is 3 sets of 12.',
    ],
    watch: 'Move the ankle, not the knees. A bounce at the bottom does not count.',
  },
  {
    name: 'Bulgarian split squat',
    phases: ['Stand', 'Bottom'],
    start: pose({
      head: [112, 28],
      shoulder: [112, 48],
      hip: [108, 96],
      kneeL: [78, 128],
      footL: [52, 148],
      kneeR: [136, 142],
      footR: [156, 198],
      gear: bench,
    }),
    end: pose({
      head: [118, 52],
      shoulder: [116, 72],
      hip: [108, 128],
      kneeL: [72, 158],
      footL: [52, 148],
      kneeR: [142, 164],
      footR: [158, 198],
      elbowL: [96, 96],
      handL: [88, 120],
      elbowR: [138, 96],
      handR: [148, 118],
      gear: bench,
    }),
    cues: [
      'Rear foot on a bench, front foot far enough forward that the knee can travel over the ankle.',
      'Lower until the front thigh is about parallel. Torso stays slightly leaned.',
      'Drive through the front heel. The target is 3 sets of 8 each leg.',
    ],
    watch: 'The front knee should not cave inward. The back knee drops, it does not push forward.',
  },
  {
    name: 'Single-leg RDL',
    phases: ['Stand', 'Hinge'],
    start: pose({
      kneeR: [112, 150],
      footR: [116, 176],
    }),
    end: pose({
      head: [46, 72],
      shoulder: [62, 88],
      hip: [108, 112],
      kneeL: [40, 96],
      footL: [18, 82],
      kneeR: [116, 150],
      footR: [120, 198],
      elbowL: [70, 112],
      handL: [78, 136],
      elbowR: [88, 116],
      handR: [96, 140],
    }),
    cues: [
      'Stand on one leg with a soft knee and the hips square.',
      'Hinge forward and let the free leg reach back in a straight line.',
      'Stop when the hamstring loads, then stand tall. The target is 3 sets of 8 each leg.',
    ],
    watch: 'If the hips open, shorten the hinge. Hold a wall until the balance is there.',
  },
  {
    name: 'Step-down',
    phases: ['Stand', 'Lower'],
    start: pose({
      head: [108, 18],
      shoulder: [108, 38],
      hip: [108, 78],
      kneeL: [100, 112],
      footL: [96, 144],
      kneeR: [122, 112],
      footR: [126, 144],
      elbowL: [88, 62],
      handL: [80, 88],
      elbowR: [130, 62],
      handR: [138, 88],
      gear: box,
    }),
    end: pose({
      head: [100, 28],
      shoulder: [102, 48],
      hip: [104, 86],
      kneeL: [96, 118],
      footL: [100, 144],
      kneeR: [142, 168],
      footR: [156, 198],
      elbowL: [82, 70],
      handL: [74, 96],
      elbowR: [126, 68],
      handR: [136, 92],
      gear: box,
    }),
    cues: [
      'Stand on a step on one leg. The free foot starts up with you.',
      'Bend the standing knee and lower the free heel toward the floor.',
      'Stand back up without the free foot taking over. The target is 3 sets of 8 each leg.',
    ],
    watch: 'The standing knee tracks over the toes. Sit back a little if it dives inward.',
  },
  {
    name: 'Hip thrust',
    phases: ['Set up', 'Lockout'],
    start: pose({
      head: [46, 116],
      shoulder: [68, 128],
      hip: [114, 162],
      kneeL: [152, 132],
      footL: [168, 170],
      kneeR: [156, 136],
      footR: [174, 174],
      elbowL: [58, 146],
      handL: [78, 154],
      elbowR: [80, 142],
      handR: [96, 152],
      gear: thrustBench,
    }),
    end: pose({
      head: [40, 96],
      shoulder: [64, 108],
      hip: [118, 106],
      kneeL: [158, 128],
      footL: [170, 170],
      kneeR: [162, 132],
      footR: [176, 174],
      elbowL: [52, 124],
      handL: [70, 118],
      elbowR: [86, 112],
      handR: [100, 114],
      gear: thrustBench,
    }),
    cues: [
      'Upper back on a bench, feet flat, knees bent about 90 degrees at the top.',
      'Drive the hips up until the body is a line from shoulders to knees.',
      'Squeeze the glutes and lower with control. The target is 3 sets of 8.',
    ],
    watch: 'Do not overarch the lower back at the top. Ribs stay down.',
  },
  {
    name: 'Deadlift',
    phases: ['Floor', 'Stand'],
    start: pose({
      head: [62, 112],
      shoulder: [74, 128],
      hip: [108, 118],
      kneeL: [92, 156],
      footL: [78, 198],
      kneeR: [118, 156],
      footR: [128, 198],
      elbowL: [88, 158],
      handL: [92, 182],
      elbowR: [108, 158],
      handR: [112, 182],
      gear: bar(186, 70, 140),
    }),
    end: pose({
      elbowL: [90, 96],
      handL: [90, 120],
      elbowR: [112, 96],
      handR: [112, 120],
      gear: bar(122, 84, 118),
    }),
    cues: [
      'Bar over the middle of the foot. Hinge to grip it, chest up, back flat.',
      'Push the floor away and stand tall with the bar close to the legs.',
      'Reverse the hinge to lower. The target is 3 sets of 5.',
    ],
    watch: 'If the bar swings away from the legs, the back is doing the lift. Reset.',
  },
  {
    name: 'Nordic curl',
    phases: ['Tall', 'Lower'],
    start: pose({
      head: [108, 36],
      shoulder: [108, 56],
      hip: [108, 108],
      kneeL: [100, 168],
      footL: [72, 188],
      kneeR: [116, 168],
      footR: [84, 188],
      elbowL: [86, 80],
      handL: [78, 104],
      elbowR: [130, 80],
      handR: [138, 104],
      gear: anchor,
    }),
    end: pose({
      head: [168, 112],
      shoulder: [156, 122],
      hip: [128, 148],
      kneeL: [100, 168],
      footL: [72, 188],
      kneeR: [116, 168],
      footR: [84, 188],
      elbowL: [170, 140],
      handL: [182, 168],
      elbowR: [164, 132],
      handR: [176, 156],
      gear: anchor,
    }),
    cues: [
      'Knees on a pad, feet anchored. Start tall with the hips extended.',
      'Lower the body forward by bending only at the knees. Stay long from knees to head.',
      'Catch yourself with your hands when you need to, then pull back up. The target is 3 sets of 6.',
    ],
    watch: 'Stop if a hamstring feels sharp. A shorter range is the right set.',
  },
  {
    name: 'Side plank',
    phases: ['Down', 'Hold'],
    start: pose({
      head: [42, 156],
      shoulder: [58, 166],
      hip: [108, 176],
      kneeL: [140, 182],
      footL: [168, 188],
      kneeR: [140, 176],
      footR: [168, 182],
      elbowL: [48, 186],
      handL: [36, 196],
      elbowR: [70, 150],
      handR: [78, 132],
    }),
    end: pose({
      head: [40, 118],
      shoulder: [56, 132],
      hip: [108, 132],
      kneeL: [146, 132],
      footL: [176, 132],
      kneeR: [146, 126],
      footR: [176, 126],
      elbowL: [48, 168],
      handL: [36, 186],
      elbowR: [72, 108],
      handR: [84, 92],
    }),
    cues: [
      'Elbow under the shoulder, feet stacked, body on its side.',
      'Lift the hips until there is a straight line from head to heels.',
      'Hold. Log the seconds in the reps box. The target is 20-30 seconds each side.',
    ],
    watch: 'Do not let the hips sag or twist open. Switch sides between sets.',
  },
];

const BY_KEY = new Map(DEMOS.map((demo) => [exerciseKey(demo.name), demo]));

export function findDemo(name: string): ExerciseDemo | undefined {
  return BY_KEY.get(exerciseKey(name));
}

export function demoNames(): string[] {
  return DEMOS.map((demo) => demo.name);
}
