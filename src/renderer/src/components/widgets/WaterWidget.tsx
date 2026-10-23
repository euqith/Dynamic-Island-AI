import React from 'react';
import { Droplet, Settings } from 'lucide-react';
import { WaterState } from '../../../../types';

interface WaterWidgetProps {
  water: WaterState;
  onDrink: () => void;
  onToggleReminder: () => void;
}

export const WaterWidget: React.FC<WaterWidgetProps> = ({
  water,
  onDrink,
  onToggleReminder,
}) => {
  const percentage = Math.round((water.currentLiters / water.targetLiters) * 100);

  return (
    <div className="flex items-center justify-between h-full px-5 py-2">
      {/* Left Info: Volume and Drink CTA */}
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium">
            <span className="text-zinc-200 font-semibold">Water</span>
            <span className="text-sky-400">Reminder</span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-white tracking-tight">
              {water.currentLiters.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              / {water.targetLiters.toFixed(1)} L
            </span>
          </div>

          <p className="text-[10px] text-zinc-400 mt-0.5">
            Today {percentage}% · {water.remindersEnabled ? 'Reminders on' : 'Reminders off'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onDrink}
            className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-medium px-3 py-1 rounded-full transition-transform active:scale-95 cursor-pointer shadow-sm shadow-sky-500/20"
          >
            <Droplet size={11} className="fill-current" />
            <span>Drink</span>
          </button>

          <button
            onClick={onToggleReminder}
            className="flex items-center gap-1 text-zinc-400 hover:text-white text-[11px] px-2 py-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Settings size={12} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Right: Intake Bar Chart */}
      <div className="flex flex-col justify-between h-full pl-4 border-l border-white/5">
        <div className="text-[10px] text-zinc-400 text-right">
          <span className="bg-sky-950/60 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            +200 ml
          </span>
        </div>

        {/* Mini hourly bar chart */}
        <div className="flex items-end gap-2 h-14 mt-1">
          {[
            { hour: '00', val: 35 },
            { hour: '01', val: 70 },
            { hour: '02', val: 50 },
            { hour: '03', val: 85 },
          ].map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-3 bg-zinc-800 rounded-t-sm h-12 flex items-end overflow-hidden">
                <div
                  className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-sm transition-all duration-500"
                  style={{ height: `${bar.val}%` }}
                />
              </div>
              <span className="text-[8px] text-zinc-500 font-mono">{bar.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
