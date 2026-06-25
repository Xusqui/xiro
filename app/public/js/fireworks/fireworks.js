/**
 * @fileoverview Módulo principal del sistema de fuegos artificiales
 * Gestiona la inicialización, animación y control de fuegos artificiales
 */

'use strict';

/**
 * Sound manager for fireworks. Loads audio files from /js/fireworks/sounds/
 * and exposes a simple playSound() API. Silently no-ops if sound is disabled.
 */
const soundManager = {
  _ctx: null,
  _enabled: false,
  _loaded: false,
  _lastSmallBurstTime: 0,
  _burstCount: 0,
  _fadeSteps: 12,

  sources: {
    lift: { volume: 1, playbackRateMin: 0.85, playbackRateMax: 0.95, fileNames: ['lift1.mp3', 'lift2.mp3', 'lift3.mp3'] },
    burst: { volume: 1, playbackRateMin: 0.80, playbackRateMax: 0.90, fileNames: ['burst1.mp3', 'burst2.mp3'] },
    burstSmall: { volume: 0.25, playbackRateMin: 0.80, playbackRateMax: 1.00, fileNames: ['burst-sm-1.mp3', 'burst-sm-2.mp3'] },
    crackle: { volume: 0.20, playbackRateMin: 1, playbackRateMax: 1, fileNames: ['crackle1.mp3'] },
    crackleSmall: { volume: 0.30, playbackRateMin: 1, playbackRateMax: 1, fileNames: ['crackle-sm-1.mp3'] }
  },

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  },

  preload() {
    if (this._loaded) return Promise.resolve();
    const baseURL = '/js/fireworks/sounds/';
    const ctx = this._getCtx();
    const allPromises = [];

    Object.values(this.sources).forEach(src => {
      const filePromises = src.fileNames.map(name =>
        fetch(baseURL + name)
          .then(r => { if (!r.ok) throw new Error(r.statusText); return r.arrayBuffer(); })
          .then(data => new Promise(resolve => ctx.decodeAudioData(data, resolve)))
      );
      const p = Promise.all(filePromises).then(buffers => { src.buffers = buffers; });
      allPromises.push(p);
    });

    return Promise.all(allPromises).then(() => { this._loaded = true; });
  },

  resetFade() {
    this._burstCount = 0;
  },

  setEnabled(enabled) {
    this._enabled = enabled;
    if (enabled) {
      const ctx = this._getCtx();
      this.preload()
        .then(() => ctx.resume())
        .catch(e => console.error('[SoundManager] error en preload/resume:', e));
      this._unlockOnInteraction();
    } else {
      if (this._ctx) this._ctx.suspend();
    }
  },

  _unlockOnInteraction() {
    if (!this._ctx || this._ctx.state === 'running') return;
    const unlock = () => {
      if (this._ctx) this._ctx.resume().catch(() => { });
    };
    ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt =>
      document.addEventListener(evt, unlock, { once: true, capture: true })
    );
  },

  playSound(type, scale = 1) {
    if (!this._enabled || !this._loaded) return;
    scale = Math.min(Math.max(scale, 0), 1);

    if (type === 'burstSmall') {
      const now = Date.now();
      if (now - this._lastSmallBurstTime < 20) return;
      this._lastSmallBurstTime = now;
    }

    const src = this.sources[type];
    if (!src || !src.buffers) return;

    // Fade out volume progressively over _fadeSteps explosions, floor at 15%
    const fadeFactor = Math.max(0.05, 1 - this._burstCount / this._fadeSteps);
    if (type === 'burst' || type === 'crackle' || type === 'crackleSmall') {
      this._burstCount++;
    }
    if (fadeFactor === 0) return;

    const ctx = this._getCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = src.volume * scale * fadeFactor;

    const buffer = src.buffers[Math.random() * src.buffers.length | 0];
    const bufSrc = ctx.createBufferSource();
    bufSrc.playbackRate.value = MyMath.random(src.playbackRateMin, src.playbackRateMax) * (2 - scale);
    bufSrc.buffer = buffer;
    bufSrc.connect(gainNode);
    gainNode.connect(ctx.destination);
    bufSrc.start(0);
  }
};

class FireworksController {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }

    this.isRunning = false;
    this.currentFrame = 0;
    this.simSpeed = 1;
    this.autoLaunchTime = 0;
    this.autoLaunchEnabled = true;
    this.finaleMode = false;
    this.finaleCount = 0;
    this.maxFinaleCount = 32;
    this.shellSize = 2;

    // Intervalos configurables de lanzamiento
    this.launchIntervalMin = 900;
    this.launchIntervalMax = 1500;

    // Parámetros visuales configurables
    this.trailIntensity = 0.175;
    this.starWidth = 3;
    this.sparkWidth = 1;

    // Sonido
    this.soundEnabled = false;

    this.stageW = 0;
    this.stageH = 0;

    Star.active = createParticleCollection();
    Spark.active = createParticleCollection();

    this.setupCanvas();

    this.update = this.update.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  setupCanvas() {
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'fireworks-canvas-container';
    canvasContainer.innerHTML = `
      <canvas id="fireworks-trails-canvas"></canvas>
      <canvas id="fireworks-main-canvas"></canvas>
    `;
    this.container.appendChild(canvasContainer);

    this.trailsStage = new Stage('fireworks-trails-canvas');
    this.mainStage = new Stage('fireworks-main-canvas');
    this.stages = [this.trailsStage, this.mainStage];

    this.handleResize();

    window.addEventListener('resize', this.handleResize);
  }

  handleResize() {
    const rect = this.container.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    this.stages.forEach(stage => stage.resize(containerW, containerH));
    this.stageW = containerW;
    this.stageH = containerH;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.autoLaunchTime = 1000;
    this.lastFrameTime = performance.now();
    soundManager.resetFade();
    requestAnimationFrame(this.update);
  }

  stop() {
    this.isRunning = false;
  }

  update(currentTime) {
    if (!this.isRunning) return;

    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    const timeStep = Math.min(frameTime, 100) * this.simSpeed;
    const lag = timeStep / 16.667;

    this.updateParticles(timeStep, lag);
    this.updateAutoLaunch(timeStep);
    this.render(lag);

    this.currentFrame++;
    requestAnimationFrame(this.update);
  }

  updateAutoLaunch(timeStep) {
    if (!this.autoLaunchEnabled) return;

    this.autoLaunchTime -= timeStep;
    if (this.autoLaunchTime <= 0) {
      if (this.finaleMode && this.finaleCount < this.maxFinaleCount) {
        this.launchRandomShell();
        this.finaleCount++;
        this.autoLaunchTime = 170;
      } else {
        this.launchRandomShell();
        this.finaleCount = 0;
        // Usar intervalos configurables
        const range = this.launchIntervalMax - this.launchIntervalMin;
        this.autoLaunchTime = this.launchIntervalMin + Math.random() * range;
      }
    }
  }

  updateParticles(timeStep, lag) {
    const speed = this.simSpeed * lag;
    const gAcc = timeStep / 1000 * GRAVITY;
    const starDrag = 1 - (1 - Star.airDrag) * speed;
    const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
    const sparkDrag = 1 - (1 - Spark.airDrag) * speed;

    COLOR_CODES_W_INVIS.forEach(color => {
      const stars = Star.active[color];
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        if (star.updateFrame === this.currentFrame) continue;
        star.updateFrame = this.currentFrame;

        star.life -= timeStep;
        if (star.life <= 0) {
          stars.splice(i, 1);
          Star.returnInstance(star);
        } else {
          const burnRate = Math.pow(star.life / star.fullLife, 0.5);
          const burnRateInverse = 1 - burnRate;

          star.prevX = star.x;
          star.prevY = star.y;
          star.x += star.speedX * speed;
          star.y += star.speedY * speed;

          if (!star.heavy) {
            star.speedX *= starDrag;
            star.speedY *= starDrag;
          } else {
            star.speedX *= starDragHeavy;
            star.speedY *= starDragHeavy;
          }
          star.speedY += gAcc;

          if (star.spinRadius) {
            star.spinAngle += star.spinSpeed * speed;
            star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
            star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
          }

          if (star.sparkFreq) {
            star.sparkTimer -= timeStep;
            while (star.sparkTimer < 0) {
              star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
              Spark.add(
                star.x,
                star.y,
                star.sparkColor,
                Math.random() * Math.PI * 2,
                Math.random() * star.sparkSpeed * burnRate,
                star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
              );
            }
          }

          if (star.life < star.transitionTime) {
            if (star.secondColor && !star.colorChanged) {
              star.colorChanged = true;
              star.color = star.secondColor;
              stars.splice(i, 1);
              Star.active[star.secondColor].push(star);
              if (star.secondColor === INVISIBLE) {
                star.sparkFreq = 0;
              }
            }

            if (star.strobe) {
              star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
            }
          }
        }
      }

      const sparks = Spark.active[color];
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.life -= timeStep;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          Spark.returnInstance(spark);
        } else {
          spark.prevX = spark.x;
          spark.prevY = spark.y;
          spark.x += spark.speedX * speed;
          spark.y += spark.speedY * speed;
          spark.speedX *= sparkDrag;
          spark.speedY *= sparkDrag;
          spark.speedY += gAcc;
        }
      }
    });
  }

  render(speed) {
    const { dpr } = this.mainStage;
    const width = this.stageW;
    const height = this.stageH;
    const trailsCtx = this.trailsStage.ctx;
    const mainCtx = this.mainStage.ctx;

    trailsCtx.scale(dpr, dpr);
    mainCtx.scale(dpr, dpr);

    // Fade trails: destination-in reduce la alpha de los pixels existentes (evita
    // colores residuales near-black que con source-over dejarían smear visible).
    // El problema es que los pixels semitransparentes resultantes se componen mal
    // dentro del contexto mix-blend-mode:screen del DOM, produciendo un leve tinte.
    // Solución: tras el fade, destination-over rellena con negro opaco POR DEBAJO
    // del contenido existente → zonas transparentes/semitransparentes pasan a
    // negro opaco → screen(negro, backdrop) = backdrop exacto, sin alteración.
    trailsCtx.globalCompositeOperation = 'destination-in';
    trailsCtx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - this.trailIntensity * speed)})`;
    trailsCtx.fillRect(0, 0, width, height);
    // Rellenar zonas transparentes con negro opaco (dibuja BAJO el contenido existente).
    trailsCtx.globalCompositeOperation = 'destination-over';
    trailsCtx.fillStyle = 'rgb(0, 0, 0)';
    trailsCtx.fillRect(0, 0, width, height);
    trailsCtx.globalCompositeOperation = 'source-over';

    mainCtx.clearRect(0, 0, width, height);

    // BurstFlash on mainCtx (cleared every frame) so the large warm-orange radial
    // gradient never accumulates on the trails canvas where it would persist as a
    // visible screen-blended smear across multiple frames.
    while (BurstFlash.active.length) {
      const bf = BurstFlash.active.pop();

      const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
      burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
      burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
      burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
      burstGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mainCtx.fillStyle = burstGradient;
      mainCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);

      BurstFlash.returnInstance(bf);
    }

    trailsCtx.globalCompositeOperation = 'lighten';

    trailsCtx.lineWidth = this.starWidth;
    trailsCtx.lineCap = 'round';
    mainCtx.strokeStyle = '#fff';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();

    COLOR_CODES.forEach(color => {
      const stars = Star.active[color];
      trailsCtx.strokeStyle = color;
      trailsCtx.beginPath();
      stars.forEach(star => {
        if (star.visible) {
          trailsCtx.moveTo(star.x, star.y);
          trailsCtx.lineTo(star.prevX, star.prevY);
          mainCtx.moveTo(star.x, star.y);
          mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
        }
      });
      trailsCtx.stroke();
    });
    mainCtx.stroke();

    // Sparks on mainCtx (cleared every frame) instead of trailsCtx.
    // While a spark is alive, 'lighten' on trailsCtx would reset its pixel to
    // alpha=1 every frame, defeating the destination-in fade entirely.  With
    // sparkLifeVariation=3 that means pixels stay at full brightness for up to
    // ~1200 ms, leaving a bright smear along the entire ascent path.
    // On mainCtx, sparks are visible each frame they exist but accumulate nothing.
    mainCtx.lineWidth = this.sparkWidth;
    mainCtx.lineCap = 'butt';
    COLOR_CODES.forEach(color => {
      const sparks = Spark.active[color];
      mainCtx.strokeStyle = color;
      mainCtx.beginPath();
      sparks.forEach(spark => {
        mainCtx.moveTo(spark.x, spark.y);
        mainCtx.lineTo(spark.prevX, spark.prevY);
      });
      mainCtx.stroke();
    });

    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  launchRandomShell() {
    const size = this.shellSize;
    const baseSize = size;
    const maxVariance = Math.min(2.5, baseSize);
    const variance = Math.random() * maxVariance;
    const shellSize = baseSize - variance;
    const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
    const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
    const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;

    const shell = new Shell(randomShell(shellSize));
    shell.launch(x, height * 0.75, this.stageW, this.stageH);
  }

  setShellSize(size) {
    this.shellSize = MyMath.clamp(size, 0, 4);
  }

  setAutoLaunch(enabled) {
    this.autoLaunchEnabled = enabled;
  }

  setFinaleMode(enabled) {
    this.finaleMode = enabled;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
    soundManager.setEnabled(enabled);
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    if (this.container && this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
