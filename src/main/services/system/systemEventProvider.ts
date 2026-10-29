import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { SystemHUDEvent } from '../../../types';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export class SystemEventProvider {
  private listeners: ((event: SystemHUDEvent) => void)[] = [];
  
  // Timers
  private volumeTimer: NodeJS.Timeout | null = null;
  private batteryTimer: NodeJS.Timeout | null = null;
  private bluetoothTimer: NodeJS.Timeout | null = null;

  // Concurrency Mutexes
  private isCheckingVolume: boolean = false;
  private isCheckingBattery: boolean = false;
  private isCheckingBluetooth: boolean = false;

  // Previous States
  private lastVolume: number = -1;
  private lastMuted: boolean = false;
  private isInitialVolume: boolean = true;

  private lastPowerSource: string = '';
  private lastBatteryPercent: number = -1;
  private isInitialBattery: boolean = true;

  private lastConnectedBluetoothDevices: Set<string> = new Set();
  private isInitialBluetooth: boolean = true;

  constructor() {
    if (process.platform === 'darwin') {
      this.startVolumeWatcher();
      this.startBatteryWatcher();
      this.startBluetoothWatcher();
    }
  }

  public onHUDEvent(callback: (event: SystemHUDEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private emitHUDEvent(event: SystemHUDEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error emitting HUD event:', err);
      }
    }
  }

  /**
   * Volume Watcher
   * Polls every 350ms using osascript. Very fast (<25ms) and lightweight.
   */
  private startVolumeWatcher() {
    this.checkVolume();
    this.volumeTimer = setInterval(() => {
      this.checkVolume();
    }, 350);
  }

  private async checkVolume() {
    if (this.isCheckingVolume) return;
    this.isCheckingVolume = true;

    try {
      const script = 'set s to get volume settings\nreturn (output volume of s as string) & "|||" & (output muted of s as string)';
      const { stdout } = await execFileAsync('osascript', ['-e', script]);
      const parts = stdout.trim().split('|||');
      if (parts.length === 2) {
        const volume = parseInt(parts[0], 10);
        const isMuted = parts[1].trim().toLowerCase() === 'true';

        if (this.isInitialVolume) {
          this.lastVolume = volume;
          this.lastMuted = isMuted;
          this.isInitialVolume = false;
          return;
        }

        if (volume !== this.lastVolume || isMuted !== this.lastMuted) {
          this.lastVolume = volume;
          this.lastMuted = isMuted;

          this.emitHUDEvent({
            type: 'volume',
            volume,
            isMuted,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // Ignored
    } finally {
      this.isCheckingVolume = false;
    }
  }

  /**
   * Battery & Charging Watcher
   * Polls every 2500ms using pmset -g batt (<10ms).
   */
  private startBatteryWatcher() {
    this.checkBattery();
    this.batteryTimer = setInterval(() => {
      this.checkBattery();
    }, 2500);
  }

  private async checkBattery() {
    if (this.isCheckingBattery) return;
    this.isCheckingBattery = true;

    try {
      const { stdout } = await execAsync('pmset -g batt');
      const lines = stdout.trim().split('\n');
      if (lines.length >= 1) {
        const isACPower = lines[0].includes("'AC Power'");
        const powerSource = isACPower ? 'AC Power' : 'Battery Power';

        // Extract percentage
        let percent = this.lastBatteryPercent;
        const matchPercent = stdout.match(/(\d+)%/);
        if (matchPercent && matchPercent[1]) {
          percent = parseInt(matchPercent[1], 10);
        }

        const isCharging = isACPower || stdout.toLowerCase().includes('charging');

        if (this.isInitialBattery) {
          this.lastPowerSource = powerSource;
          this.lastBatteryPercent = percent;
          this.isInitialBattery = false;
          return;
        }

        if (powerSource !== this.lastPowerSource) {
          this.lastPowerSource = powerSource;
          this.lastBatteryPercent = percent;

          this.emitHUDEvent({
            type: 'charging',
            isCharging,
            batteryPercent: percent,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // Ignored
    } finally {
      this.isCheckingBattery = false;
    }
  }

  /**
   * Bluetooth Connection Watcher
   * Polls every 3500ms using system_profiler SPBluetoothDataType -json (~80ms).
   */
  private startBluetoothWatcher() {
    this.checkBluetooth();
    this.bluetoothTimer = setInterval(() => {
      this.checkBluetooth();
    }, 3500);
  }

  private async checkBluetooth() {
    if (this.isCheckingBluetooth) return;
    this.isCheckingBluetooth = true;

    try {
      const { stdout } = await execAsync('system_profiler SPBluetoothDataType -json');
      const data = JSON.parse(stdout);
      const connectedDevices = new Set<string>();

      if (data?.SPBluetoothDataType && Array.isArray(data.SPBluetoothDataType)) {
        for (const item of data.SPBluetoothDataType) {
          if (item?.device_connected && Array.isArray(item.device_connected)) {
            for (const dev of item.device_connected) {
              const name = Object.keys(dev)[0];
              if (name) connectedDevices.add(name);
            }
          }
        }
      }

      if (this.isInitialBluetooth) {
        this.lastConnectedBluetoothDevices = connectedDevices;
        this.isInitialBluetooth = false;
        return;
      }

      // Check newly connected
      for (const devName of connectedDevices) {
        if (!this.lastConnectedBluetoothDevices.has(devName)) {
          this.emitHUDEvent({
            type: 'bluetooth',
            deviceName: devName,
            connected: true,
            timestamp: Date.now(),
          });
        }
      }

      // Check disconnected
      for (const devName of this.lastConnectedBluetoothDevices) {
        if (!connectedDevices.has(devName)) {
          this.emitHUDEvent({
            type: 'bluetooth',
            deviceName: devName,
            connected: false,
            timestamp: Date.now(),
          });
        }
      }

      this.lastConnectedBluetoothDevices = connectedDevices;
    } catch {
      // Ignored
    } finally {
      this.isCheckingBluetooth = false;
    }
  }

  public destroy() {
    if (this.volumeTimer) clearInterval(this.volumeTimer);
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    if (this.bluetoothTimer) clearInterval(this.bluetoothTimer);
  }
}

