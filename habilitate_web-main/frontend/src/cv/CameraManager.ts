/**
 * Manages browser camera access.
 * - Requests permission on first use
 * - Creates video stream from front-facing camera
 * - Handles permission denied gracefully
 * - Works on mobile (tablet) and desktop
 */
export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    this.videoElement = videoElement;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      videoElement.srcObject = this.stream;
      videoElement.muted = true;
      await videoElement.play();
      return true;
    } catch {
      this.stream = null;
      return false;
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }
}
