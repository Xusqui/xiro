/**
 * @fileoverview Sistema de partículas para fuegos artificiales (Star, Spark, BurstFlash)
 */

'use strict';

const Star = {
  drawWidth: 3,
  airDrag: 0.98,
  airDragHeavy: 0.992,
  
  active: null,
  _pool: [],
  
  _new() {
    return {};
  },

  add(x, y, color, angle, speed, life, speedOffX, speedOffY) {
    const instance = this._pool.pop() || this._new();
    
    instance.visible = true;
    instance.heavy = false;
    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color;
    instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
    instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
    instance.life = life;
    instance.fullLife = life;
    instance.spinAngle = Math.random() * (Math.PI * 2);
    instance.spinSpeed = 0.8;
    instance.spinRadius = 0;
    instance.sparkFreq = 0;
    instance.sparkSpeed = 1;
    instance.sparkTimer = 0;
    instance.sparkColor = color;
    instance.sparkLife = 750;
    instance.sparkLifeVariation = 0.25;
    instance.strobe = false;
    
    this.active[color].push(instance);
    return instance;
  },

  returnInstance(instance) {
    instance.onDeath && instance.onDeath(instance);
    instance.onDeath = null;
    instance.secondColor = null;
    instance.transitionTime = 0;
    instance.colorChanged = false;
    this._pool.push(instance);
  }
};

const Spark = {
  drawWidth: 1,
  airDrag: 0.9,
  
  active: null,
  _pool: [],
  
  _new() {
    return {};
  },

  add(x, y, color, angle, speed, life) {
    const instance = this._pool.pop() || this._new();
    
    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color;
    instance.speedX = Math.sin(angle) * speed;
    instance.speedY = Math.cos(angle) * speed;
    instance.life = life;
    
    this.active[color].push(instance);
    return instance;
  },

  returnInstance(instance) {
    this._pool.push(instance);
  }
};

const BurstFlash = {
  active: [],
  _pool: [],
  
  _new() {
    return {};
  },
  
  add(x, y, radius) {
    const instance = this._pool.pop() || this._new();
    
    instance.x = x;
    instance.y = y;
    instance.radius = radius;
    
    this.active.push(instance);
    return instance;
  },
  
  returnInstance(instance) {
    this._pool.push(instance);
  }
};
