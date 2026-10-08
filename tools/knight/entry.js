import { createState, stepFrame } from './DEVICE_KNIGHT/sim/index.js';
import { buildSingleAttackScene, ATTACK_MENU } from './DEVICE_KNIGHT/sim/scenes/single.js';
import { createRenderer } from './DEVICE_KNIGHT/render/canvas.js';
import { drainCues } from './DEVICE_KNIGHT/sim/audio.js';
import { createInput } from './DEVICE_KNIGHT/input/state.js';
globalThis.DKSIM = { createState, stepFrame, buildSingleAttackScene, ATTACK_MENU, createRenderer, drainCues, createInput };
