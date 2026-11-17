// Solcayo — keyboard + mouse input, translated into game actions.
export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed once by the game loop
  const input = {
    keys, pressed,
    up: false, down: false, left: false, right: false,
    run: false, handbrake: false,
    interactPressed: false, punchPressed: false, pausePressed: false,
    mutePressed: false, anyKey: false,
    mouse: { x: 0, y: 0, clicked: false },
    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        if (!e.repeat) { keys.add(e.key.toLowerCase()); pressed.add(e.key.toLowerCase()); }
        input.anyKey = true;
      });
      window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
      canvas.addEventListener('pointerdown', (e) => {
        const r = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - r.left; input.mouse.y = e.clientY - r.top;
        input.mouse.clicked = true; input.anyKey = true;
      });
      window.addEventListener('blur', () => keys.clear());
    },
    // Called once per fixed tick: fold raw keys into stable action flags.
    poll() {
      const k = keys;
      input.up = k.has('w') || k.has('arrowup');
      input.down = k.has('s') || k.has('arrowdown');
      input.left = k.has('a') || k.has('arrowleft');
      input.right = k.has('d') || k.has('arrowright');
      input.run = k.has('shift');
      input.handbrake = k.has(' ');
      input.interactPressed = pressed.has('e');
      input.punchPressed = pressed.has(' ') || pressed.has('j');
      input.pausePressed = pressed.has('escape') || pressed.has('p');
      input.mutePressed = pressed.has('m');
      pressed.clear();
    },
    consumeClick() { const c = input.mouse.clicked; input.mouse.clicked = false; return c; },
  };
  return input;
}
