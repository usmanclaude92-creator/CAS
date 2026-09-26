/**
 * Session Security Service
 * Handles idle timeout tracking, activity listeners, 60-second pre-expiration warning,
 * and automatic logout for financial compliance and data protection.
 */

export interface SessionSecurityState {
  isActive: boolean;
  isWarningOpen: boolean;
  remainingSeconds: number;
  totalTimeoutSeconds: number;
  timeoutMinutes: number;
}

const STORAGE_TIMEOUT_MINUTES_KEY = 'construction_session_timeout_minutes_v1';
const DEFAULT_TIMEOUT_MINUTES = 15;
const WARNING_THRESHOLD_SECONDS = 60; // Triggers warning modal strictly 60 seconds before expiration

type SessionSecurityListener = (state: SessionSecurityState) => void;
type SessionExpiredHandler = () => void;

class SessionSecurityService {
  private timeoutMinutes: number = DEFAULT_TIMEOUT_MINUTES;
  private lastActivity: number = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: SessionSecurityListener[] = [];
  private onExpiredHandlers: SessionExpiredHandler[] = [];
  private isRunning: boolean = false;
  private isWarningOpen: boolean = false;
  private lastThrottleTime: number = 0;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_TIMEOUT_MINUTES_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.timeoutMinutes = parsed;
        }
      }
    } catch {
      this.timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
    }
  }

  /**
   * Start tracking user activity and session expiration
   */
  public startTracking() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastActivity = Date.now();
    this.isWarningOpen = false;

    this.attachActivityListeners();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Tick every 1 second
    this.checkInterval = setInterval(() => {
      this.tick();
    }, 1000);

    this.notify();
  }

  /**
   * Stop tracking (e.g. upon user logout)
   */
  public stopTracking() {
    this.isRunning = false;
    this.isWarningOpen = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.detachActivityListeners();
    this.notify();
  }

  /**
   * Records user activity (mouse, keystroke, touch, scroll)
   * Only throttled to once every 1000ms to avoid unnecessary load.
   */
  public recordActivity() {
    // If the 60-second warning modal is currently shown, we require explicit action
    // (clicking 'Stay Signed In') to extend the session, preventing accidental mouse movements from clearing security prompt.
    if (this.isWarningOpen) {
      return;
    }

    const now = Date.now();
    if (now - this.lastThrottleTime > 1000) {
      this.lastThrottleTime = now;
      this.lastActivity = now;
    }
  }

  /**
   * Explicitly extend the session (e.g. when clicking 'Stay Signed In' in the warning modal)
   */
  public extendSession() {
    this.lastActivity = Date.now();
    this.lastThrottleTime = Date.now();
    this.isWarningOpen = false;
    this.notify();
  }

  /**
   * Test helper: simulates reaching the 60-second warning immediately
   */
  public simulateWarningCountdown(secondsRemaining: number = 60) {
    const totalSecs = this.timeoutMinutes * 60;
    this.lastActivity = Date.now() - (totalSecs - secondsRemaining) * 1000;
    this.isWarningOpen = true;
    this.notify();
  }

  /**
   * Returns current seconds remaining before session expires
   */
  public getRemainingSeconds(): number {
    if (!this.isRunning) return this.timeoutMinutes * 60;
    const elapsedSeconds = Math.floor((Date.now() - this.lastActivity) / 1000);
    const totalSeconds = this.timeoutMinutes * 60;
    return Math.max(0, totalSeconds - elapsedSeconds);
  }

  public getTimeoutMinutes(): number {
    return this.timeoutMinutes;
  }

  public setTimeoutMinutes(minutes: number) {
    if (minutes < 1) return;
    this.timeoutMinutes = minutes;
    try {
      localStorage.setItem(STORAGE_TIMEOUT_MINUTES_KEY, minutes.toString());
    } catch {
      // ignore
    }
    this.lastActivity = Date.now();
    this.isWarningOpen = false;
    this.notify();
  }

  public getState(): SessionSecurityState {
    const remainingSeconds = this.getRemainingSeconds();
    return {
      isActive: this.isRunning,
      isWarningOpen: this.isWarningOpen,
      remainingSeconds,
      totalTimeoutSeconds: this.timeoutMinutes * 60,
      timeoutMinutes: this.timeoutMinutes,
    };
  }

  public subscribe(listener: SessionSecurityListener) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public onSessionExpired(handler: SessionExpiredHandler) {
    this.onExpiredHandlers.push(handler);
    return () => {
      this.onExpiredHandlers = this.onExpiredHandlers.filter((h) => h !== handler);
    };
  }

  private tick() {
    if (!this.isRunning) return;

    const remainingSeconds = this.getRemainingSeconds();

    // Trigger warning strictly 60 seconds before expiration
    if (remainingSeconds <= WARNING_THRESHOLD_SECONDS && remainingSeconds > 0) {
      if (!this.isWarningOpen) {
        this.isWarningOpen = true;
      }
      this.notify();
    } else if (remainingSeconds <= 0) {
      // Session expired!
      this.isWarningOpen = false;
      this.stopTracking();
      this.onExpiredHandlers.forEach((handler) => {
        try {
          handler();
        } catch (e) {
          console.error('[SessionSecurityService] Error in expiration handler:', e);
        }
      });
    } else {
      if (this.isWarningOpen) {
        this.isWarningOpen = false;
      }
      this.notify();
    }
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[SessionSecurityService] Error in listener:', e);
      }
    });
  }

  private handleUserActivity = () => {
    this.recordActivity();
  };

  private attachActivityListeners() {
    if (typeof window === 'undefined') return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, this.handleUserActivity, { passive: true });
    });
  }

  private detachActivityListeners() {
    if (typeof window === 'undefined') return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => {
      window.removeEventListener(evt, this.handleUserActivity);
    });
  }
}

export const sessionSecurityService = new SessionSecurityService();
