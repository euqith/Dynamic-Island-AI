import { NotificationPayload } from '../../../types';

export class NotificationProvider {
  private listeners: ((notification: NotificationPayload) => void)[] = [];

  constructor() {
    // Proactively register listener mechanisms
  }

  public onNotification(listener: (notification: NotificationPayload) => void) {
    this.listeners.push(listener);
  }

  public emitNotification(payload: NotificationPayload) {
    // Sanitize string content against XSS
    const safePayload: NotificationPayload = {
      ...payload,
      title: this.sanitize(payload.title),
      body: this.sanitize(payload.body),
      appName: this.sanitize(payload.appName),
    };

    for (const listener of this.listeners) {
      listener(safePayload);
    }
  }

  private sanitize(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
