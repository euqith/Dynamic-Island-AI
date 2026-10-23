import React from 'react';
import { CheckCircle2, Circle, Plus, Edit3 } from 'lucide-react';
import { TaskItem } from '../../../../types';

interface TodoWidgetProps {
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onAddTask: () => void;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
}) => {
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="flex items-center justify-between h-full px-5 py-2">
      {/* Left: Progress Summary and Action Buttons */}
      <div className="flex flex-col justify-between h-full">
        <div>
          <span className="text-[11px] font-semibold text-emerald-400">TodoList</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-white font-mono">
              {completedCount}/{tasks.length}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-0.5">Task Done Today</p>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onAddTask}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-[10px] px-2.5 py-1 rounded-full transition-transform active:scale-95 cursor-pointer"
          >
            <Plus size={11} />
            <span>Add Task</span>
          </button>
          <button className="flex items-center gap-1 text-zinc-400 hover:text-white text-[10px] px-2 py-1 rounded-full transition-colors cursor-pointer">
            <Edit3 size={11} />
            <span>Edit Task</span>
          </button>
        </div>
      </div>

      {/* Right: Checkbox Task List */}
      <div className="flex-1 max-w-[210px] flex flex-col justify-center gap-1.5 pl-3 border-l border-white/5 overflow-hidden">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onToggleTask(task.id)}
            className="flex items-center gap-2 group cursor-pointer"
          >
            {task.completed ? (
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            ) : (
              <Circle size={13} className="text-zinc-500 group-hover:text-zinc-400 shrink-0" />
            )}
            <div className="truncate flex-1">
              <span
                className={`text-[11px] block truncate transition-colors ${
                  task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                }`}
              >
                {task.text}
              </span>
              {task.timeRange && (
                <span className="text-[9px] text-zinc-500 block font-mono">
                  {task.timeRange}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
