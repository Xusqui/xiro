'use strict';

const REFRESH_DELAY = 20000; // ms
const RADIUS_MINI = 0.003; // relative to canvas diagonal
const RADIUS_MAXI = 0.006;
const DHUE = 1; // integer 1-10 - hue change by step

let canv, ctx; // canvas and context : global variables (I know :( )
let maxx, maxy; // canvas sizes (in pixels)

let radiush; // hexagons radius
let radius; // radius of incircle
let group;
let grid;
let evolHue, dHue;
let reachable;

// shortcuts for Math.…

const mrandom = Math.random;
const mfloor = Math.floor;
const mround = Math.round;
const mceil = Math.ceil;
const mabs = Math.abs;
const mmin = Math.min;
const mmax = Math.max;

const mPI = Math.PI;
const mPIS2 = Math.PI / 2;
const m2PI = Math.PI * 2;
const msin = Math.sin;
const mcos = Math.cos;
const matan2 = Math.atan2;

const mhypot = Math.hypot;
const msqrt = Math.sqrt;

const rac3 = msqrt(3);
const rac3s2 = rac3 / 2;

//-----------------------------------------------------------------------------
// miscellaneous functions
//-----------------------------------------------------------------------------

function alea(min, max) {
    // random number [min..max[ . If no max is provided, [0..min[
    if (typeof max === 'undefined') return min * mrandom();
    return min + (max - min) * mrandom();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function intAlea(min, max) {
    // random integer number [min..max[ . If no max is provided, [0..min[

    if (typeof max === 'undefined') {
        max = min;
        min = 0;
    }
    return mfloor(min + (max - min) * mrandom());
} // intAlea

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function arrayShuffle(array) {
    /* randomly changes the order of items in an array
                   only the order is modified, not the elements
                */
    let k1, temp;
    for (let k = array.length - 1; k >= 1; --k) {
        k1 = intAlea(0, k + 1);
        temp = array[k];
        array[k] = array[k1];
        array[k1] = temp;
    } // for k
    return array;
} // arrayShuffle

//------------------------------------------------------------------------
class Hexagon {
    static dneighbors = [
        { dx: 1, dy: 1 },
        { dx: -1, dy: 2 },
        { dx: -2, dy: 1 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -2 },
        { dx: 2, dy: -1 }
    ];
    static rot60(k) {
        return { kx: -k.ky, ky: k.kx + k.ky };
    }
    static symm(k) {
        return { kx: k.kx + k.ky, ky: -k.ky };
    }
    constructor(kx, ky) {
        this.kx = kx;
        this.ky = ky;
        this.key = getKey(kx, ky);
        this.c = {
            x: maxx / 2 + this.ky * radiush * rac3s2,
            y: maxy / 2 - (this.kx + 0.5 * this.ky) * radiush
        };
        this.isVisible =
      this.c.x >= -radius &&
      this.c.x <= maxx + radius &&
      this.c.y >= -radius &&
      this.c.y <= maxy + radius;
    } // constructor
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    draw() {
        let x, y, color;
        color = ctx.createRadialGradient(
            this.c.x + 0.4 * radius,
            this.c.y - 0.4 * radius,
            0,
            this.c.x,
            this.c.y,
            radius
        );
        color.addColorStop(0, `hsl(${evolHue} 100% 80%)`);
        color.addColorStop(0.5, `hsl(${evolHue} 100% 50%)`);
        color.addColorStop(1.0, `hsl(${evolHue} 100% 30%)`);
        ctx.beginPath();
        ctx.arc(this.c.x, this.c.y, radius, 0, m2PI);
        ctx.fillStyle = color;
        ctx.fill();
    } // Hexagon.prototype.drawHexagon
} // class Hexagon

//------------------------------------------------------------------------
class Group extends Map {
    constructor(kx, ky) {
        super();
        const addhex = (h) => {
            if (h.key < key) key = h.key;
            if (h.isVisible) this.set(h.key, h);
        };
        let key = 'z';
        const h1 = new Hexagon(kx, ky);
        addhex(h1);
        let nh = Hexagon.rot60(h1);
        const h2 = new Hexagon(nh.kx, nh.ky);
        addhex(h2);
        nh = Hexagon.rot60(nh);
        const h3 = new Hexagon(nh.kx, nh.ky);
        addhex(h3);
        nh = Hexagon.rot60(nh);
        const h4 = new Hexagon(nh.kx, nh.ky);
        addhex(h4);
        nh = Hexagon.rot60(nh);
        const h5 = new Hexagon(nh.kx, nh.ky);
        addhex(h5);
        nh = Hexagon.rot60(nh);
        const h6 = new Hexagon(nh.kx, nh.ky);
        addhex(h6);
        nh = Hexagon.symm(h1);
        let h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        nh = Hexagon.symm(h2);
        h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        nh = Hexagon.symm(h3);
        h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        nh = Hexagon.symm(h4);
        h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        nh = Hexagon.symm(h5);
        h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        nh = Hexagon.symm(h6);
        h7 = new Hexagon(nh.kx, nh.ky);
        addhex(h7);
        this.key = key;
    } // constructor
}
//------------------------------------------------------------------------
function getKey(kx, ky) {
    return `${kx}:${ky}`;
}
//------------------------------------------------------------------------

let animate;
let messages = [];
{
    // scope for animate

    let animState = 0;
    let tEnd, tEndw;
    let visitedGroups;
    let currGroup;

    animate = function (tStamp) {
        let message;
        let neighGroups, repr, ng;

        message = messages.shift();
        if (message && message.message == 'reset') animState = 0;
        if (message && message.message == 'click') animState = 0;
        window.requestAnimationFrame(animate);
        tEnd = performance.now() + 5;

        do {
            switch (animState) {
                case 0:
                    if (startOver()) {
                        ++animState;
                    }
                    break;

                case 1:
                    visitedGroups = [];
                    // we could start at (0,0) but the result is better if we go a bit away (more details towards the center)
                    reachable = [new Group(15, 0)];
                    ++animState;

                case 2:
                    if (reachable.length == 0) {
                        animState = 10; // finished !
                        tEndw = tStamp + REFRESH_DELAY;
                        break;
                    }
                    currGroup = reachable.shift();
                    if (currGroup.size > 0 && !visitedGroups.includes(currGroup.key))
                        ++animState;
                    // go with this group
                    else break;

                case 3:
                    visitedGroups.push(currGroup.key);
                    evolHue = (evolHue + dHue) % 360;
                    currGroup.forEach((hex) => hex.draw());
                    // make list of all neighbour groups
                    neighGroups = new Set();
                    repr = currGroup.values().next().value;
                    Hexagon.dneighbors.forEach((dk) => {
                        ng = new Group(repr.kx + dk.dx, repr.ky + dk.dy);
                        if (ng.size == 0) return; // all neighbors off screen
                        if (visitedGroups.includes(ng.key)) return; // already visited
                        if (reachable.find((r) => r.key == ng.key)) return;
                        neighGroups.add(ng);
                    });

                    if (neighGroups.size == 0) {
                        // no neighbours available
                        --animState; // go back and fetch in listReachable
                        break;
                    }
                    // put those groups in a random order
                    neighGroups = arrayShuffle([...neighGroups]); // change into Array
                    currGroup = neighGroups.pop(); // pick one as new current group
                    reachable.push(...neighGroups); // push the others as reachable

                    break;
                case 10:
                    if (tStamp > tEndw) animState = 0;
                    break;
            } // switch
        } while ((animState == 2 || animState == 3) && performance.now() < tEnd);
    }; // animate
} // scope for animate

//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------
// returns false if nothing can be done, true if drawing done

function startOver() {
    // canvas dimensions

    maxx = window.innerWidth;
    maxy = window.innerHeight;

    canv.width = maxx;
    canv.height = maxy;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, maxx, maxy);

    radiush = mhypot(maxx, maxy) * alea(RADIUS_MINI, RADIUS_MAXI);
    radius = radiush * rac3s2;
    evolHue = intAlea(360);
    dHue = intAlea(2) ? DHUE : -DHUE;

    return true; // ok
} // startOver

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//------------------------------------------------------------------------

function mouseClick(event) {
    messages.push({ message: 'click' });
} // mouseClick
//------------------------------------------------------------------------
//------------------------------------------------------------------------
// beginning of execution

{
    canv = document.createElement('canvas');
    canv.style.position = 'absolute';
    canv.style.zIndex = '-1'; // Added to put canvas in background
    document.body.appendChild(canv);
    ctx = canv.getContext('2d');
} // canvas creation

canv.addEventListener('click', mouseClick);
messages = [{ message: 'reset' }];
requestAnimationFrame(animate);