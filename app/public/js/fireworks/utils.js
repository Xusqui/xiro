/**
 * @fileoverview Utilidades matemáticas y helpers para el sistema de fuegos artificiales
 */

'use strict';

const MyMath = {
  random(min, max) {
    return Math.random() * (max - min) + min;
  },

  randomChoice(arr) {
    return arr[Math.random() * arr.length | 0];
  },

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  pointDist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  pointAngle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  }
};

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

const COLOR = {
  Red: '#ff0043',
  Green: '#14fc56',
  Blue: '#1e7fff',
  Purple: '#e60aff',
  Gold: '#ffbf36',
  White: '#ffffff'
};

const INVISIBLE = '_INVISIBLE_';

const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];

const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
  obj[code] = i;
  return obj;
}, {});

const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.substr(1, 2), 16),
    g: parseInt(hex.substr(3, 2), 16),
    b: parseInt(hex.substr(5, 2), 16),
  };
});

function randomColorSimple() {
  return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

let lastColor;
function randomColor(options) {
  const notSame = options && options.notSame;
  const notColor = options && options.notColor;
  const limitWhite = options && options.limitWhite;
  let color = randomColorSimple();

  if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple();
  }

  if (notSame) {
    while (color === lastColor) {
      color = randomColorSimple();
    }
  }
  else if (notColor) {
    while (color === notColor) {
      color = randomColorSimple();
    }
  }

  lastColor = color;
  return color;
}

function whiteOrGold() {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

function createParticleCollection() {
  const collection = {};
  COLOR_CODES_W_INVIS.forEach(color => {
    collection[color] = [];
  });
  return collection;
}

function createParticleArc(start, arcLength, count, randomness, particleFactory) {
  const angleDelta = arcLength / count;
  const end = start + arcLength - (angleDelta * 0.5);

  if (end > start) {
    for (let angle = start; angle < end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  } else {
    for (let angle = start; angle > end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  }
}

function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
  const R = 0.5 * Math.sqrt(count / Math.PI);
  const C = 2 * R * Math.PI;
  const C_HALF = C / 2;

  for (let i = 0; i <= C_HALF; i++) {
    const ringAngle = i / C_HALF * PI_HALF;
    const ringSize = Math.cos(ringAngle);
    const partsPerFullRing = C * ringSize;
    const partsPerArc = partsPerFullRing * (arcLength / PI_2);

    const angleInc = PI_2 / partsPerFullRing;
    const angleOffset = Math.random() * angleInc + startAngle;
    const maxRandomAngleOffset = angleInc * 0.33;

    for (let i = 0; i < partsPerArc; i++) {
      const randomAngleOffset = Math.random() * maxRandomAngleOffset;
      let angle = angleInc * i + angleOffset + randomAngleOffset;
      particleFactory(angle, ringSize);
    }
  }
}
