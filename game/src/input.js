// Solmar Heat — input.js
// Keyboard + mouse state, written so the headless autopilot can drive it by
// poking the same sets the browser listeners fill. Edge presses (pressed())
// are consumed once per frame by the game loop calling endFrame().

export class Input {
  constructor() {
    this.keys = new Set();
    this.edge = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._attached = false;
  }

  attach(canvas) {
    if (this._attached || typeof window === 'undefined') return;
    this._attached = true;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.edge.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }

  // True only on the frame the key went down.
  pressed(code) { return this.edge.has(code); }

  // Test/autopilot helper: pretend a key is held.
  hold(code) { this.keys.add(code); this.edge.add(code); }
  release(code) { this.keys.delete(code); }
  tap(code) { this.hold(code); }

  // WASD / arrows as a -1..1 pair.
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x, y };
  }

  get throttle() {
    return (this.down('KeyW') || this.down('ArrowUp')) ? 1 : 0;
  }
  get brake() {
    return (this.down('KeyS') || this.down('ArrowDown')) ? 1 : 0;
  }
  get steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }
  get handbrake() { return this.down('Space'); }

  endFrame() {
    this.edge.clear();
    this.mouse.clicked = false;
  }
}
