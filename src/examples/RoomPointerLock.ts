/** Keep browser lock state authoritative: Escape can be consumed before the page sees keydown. */
export class RoomPointerLock {
  private requested = false;
  private locked = false;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly changed: (locked: boolean) => void,
    private readonly exited: () => void, private readonly failed: () => void) {
    document.addEventListener("pointerlockchange", this.lockChanged);
    document.addEventListener("pointerlockerror", this.lockFailed);
  }

  request() {
    if (this.disposed || this.requested || this.locked) return;
    this.requested = true;
    try {
      if (!this.canvas.requestPointerLock) { this.lockFailed(); return; }
      // Browsers implement both the legacy void and newer Promise-returning API.
      const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      result?.catch(this.lockFailed);
    } catch { this.lockFailed(); }
  }

  release() {
    this.requested = false;
    this.locked = false;
    this.changed(false);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private lockChanged = () => {
    if (this.disposed) return;
    if (document.pointerLockElement === this.canvas) {
      if (!this.requested) { document.exitPointerLock(); return; }
      this.locked = true;
      this.changed(true);
    } else {
      const exited = this.locked;
      this.locked = false;
      this.requested = false;
      this.changed(false);
      if (exited) this.exited();
    }
  };

  private lockFailed = () => {
    if (!this.requested || this.disposed) return;
    this.requested = false;
    this.failed();
  };

  dispose() {
    this.release();
    this.disposed = true;
    document.removeEventListener("pointerlockchange", this.lockChanged);
    document.removeEventListener("pointerlockerror", this.lockFailed);
  }
}
