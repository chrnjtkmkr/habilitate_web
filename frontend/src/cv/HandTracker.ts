/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tracks hand movements using MediaPipe Hands.
 *
 * Simplified MVP:
 * - Hand detected in frame = hand_active
 * - Hand position moving toward center/top of frame = reaching
 * - Index finger extended while others curled = pointing
 * - Counts distinct hand movement episodes
 */

export class HandTracker {
  private activityCount = 0;
  private wasHandDetected = false;

  processFrame(handLandmarks: any[] | null): {
    hand_detected: boolean;
    hand_reaching: boolean;
    pointing_detected: boolean;
    hand_activity_count: number;
  } {
    if (!handLandmarks || handLandmarks.length === 0) {
      this.wasHandDetected = false;
      return {
        hand_detected: false,
        hand_reaching: false,
        pointing_detected: false,
        hand_activity_count: this.activityCount,
      };
    }

    // New hand episode
    if (!this.wasHandDetected) {
      this.activityCount++;
    }
    this.wasHandDetected = true;

    const hand = handLandmarks[0];
    const reaching = this.isReaching(hand);
    const pointing = this.isPointing(hand);

    return {
      hand_detected: true,
      hand_reaching: reaching,
      pointing_detected: pointing,
      hand_activity_count: this.activityCount,
    };
  }

  private isReaching(hand: any): boolean {
    try {
      // Wrist (0) and middle finger tip (12)
      // If fingertip is above wrist (lower y = higher on screen), hand is reaching up
      const wrist = hand[0] || hand.keypoints?.[0];
      const middleTip = hand[12] || hand.keypoints?.[12];

      if (!wrist || !middleTip) return false;

      const wristY = wrist.y ?? wrist[1];
      const tipY = middleTip.y ?? middleTip[1];

      // In normalized coords, lower y = higher on screen
      return (wristY - tipY) > 0.15;
    } catch {
      return false;
    }
  }

  private isPointing(hand: any): boolean {
    try {
      // Index finger tip (8) extended, other fingers curled
      // Check distance from fingertip to MCP joint for each finger
      const indexTip = hand[8] || hand.keypoints?.[8];
      const indexMcp = hand[5] || hand.keypoints?.[5];
      const middleTip = hand[12] || hand.keypoints?.[12];
      const middleMcp = hand[9] || hand.keypoints?.[9];
      const ringTip = hand[16] || hand.keypoints?.[16];
      const ringMcp = hand[13] || hand.keypoints?.[13];

      if (!indexTip || !indexMcp || !middleTip || !middleMcp || !ringTip || !ringMcp) {
        return false;
      }

      const dist = (a: any, b: any) => {
        const ax = a.x ?? a[0], ay = a.y ?? a[1];
        const bx = b.x ?? b[0], by = b.y ?? b[1];
        return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
      };

      const indexExt = dist(indexTip, indexMcp);
      const middleExt = dist(middleTip, middleMcp);
      const ringExt = dist(ringTip, ringMcp);

      // Index extended, others curled
      return indexExt > 0.12 && middleExt < 0.08 && ringExt < 0.08;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.activityCount = 0;
    this.wasHandDetected = false;
  }
}
