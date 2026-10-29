import React, { useState, useEffect, useRef } from 'react';

export type EyeMood =
  | 'happy'       // Arched solid white eyes + waving paw (Video 82.5s)
  | 'love'        // Heart shaped solid white eyes
  | 'look-left'   // Solid white eyes looking left
  | 'look-right'  // Solid white eyes looking right
  | 'look-up'     // Solid white eyes looking up
  | 'look-down'   // Solid white eyes looking down
  | 'look-center' // Solid white pill eyes centered
  | 'surprised'   // Solid white expanded pop eyes (O O)
  | 'wink'        // Wink with waving paw
  | 'curious'     // Inquisitive head-tilt look (one eye raised)
  | 'bouncy'      // Cheerful excited jumping eyes
  | 'squint'      // Focused narrowed eyes (- -)
  | 'sad'         // Drooping sad eyes (\ /)
  | 'sleepy';     // Sleepy half-closed eyes

interface IslandEyesProps {
  className?: string;
  isMusicPlaying?: boolean;
}

export const IslandEyes: React.FC<IslandEyesProps> = ({ className = '', isMusicPlaying = false }) => {
  const [mood, setMood] = useState<EyeMood>('happy');
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [eyeShift, setEyeShift] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAwake, setIsAwake] = useState<boolean>(true); // Controlled disappearance/sleeping cycle
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeCountRef = useRef<number>(0);

  // Pool of all diverse moods for random selection
  const availableMoods: EyeMood[] = [
    'happy',
    'look-center',
    'look-left',
    'look-right',
    'happy',
    'love',
    'curious',
    'surprised',
    'look-up',
    'look-down',
    'wink',
    'bouncy',
    'squint',
    'sad',
    'sleepy',
  ];

  // Random state machine with periodic disappearance
  useEffect(() => {
    let isCancelled = false;

    const scheduleNext = () => {
      if (isCancelled) return;

      if (!isAwake) {
        // In resting/hidden phase: sleep for 10 to 18 seconds, then wake back up!
        const sleepDuration = 10000 + Math.random() * 8000;
        timerRef.current = setTimeout(() => {
          if (isCancelled) return;
          setIsAwake(true);
          activeCountRef.current = 0;
          // Wake up with greeting!
          setMood(Math.random() > 0.5 ? 'happy' : 'surprised');
          setEyeShift({ x: 0, y: 0 });
          timerRef.current = setTimeout(scheduleNext, 6000);
        }, sleepDuration);
        return;
      }

      // Check if it's time to disappear into the notch after 4 - 6 long expressions
      activeCountRef.current += 1;
      const targetInteractions = 4 + Math.floor(Math.random() * 3); // 4 to 6 moves

      if (activeCountRef.current >= targetInteractions) {
        // Disappear / hide into notch
        setIsAwake(false);
        scheduleNext();
        return;
      }

      // Pick a random mood different from the current mood
      let nextMood: EyeMood;
      do {
        const randomIndex = Math.floor(Math.random() * availableMoods.length);
        nextMood = availableMoods[randomIndex];
      } while (nextMood === mood);

      setMood(nextMood);

      // Configure whole-eye shift coordinates
      switch (nextMood) {
        case 'look-left':
          setEyeShift({ x: -3.5, y: 0 });
          break;
        case 'look-right':
          setEyeShift({ x: 3.5, y: 0 });
          break;
        case 'look-up':
          setEyeShift({ x: 0, y: -2.8 });
          break;
        case 'look-down':
          setEyeShift({ x: 0, y: 2.8 });
          break;
        case 'sad':
          setEyeShift({ x: 0, y: 2 });
          break;
        case 'curious':
          setEyeShift({ x: 1, y: -1 });
          break;
        default:
          setEyeShift({ x: 0, y: 0 });
          break;
      }

      // Durasi 1 animasi diperpanjang menjadi jauh lebih lama & santai (5.5s hingga 9.5s)
      const duration =
        nextMood === 'happy' || nextMood === 'love' || nextMood === 'bouncy' || nextMood === 'wink'
          ? 6500 + Math.random() * 3000 // 6.5s - 9.5s
          : nextMood === 'surprised'
            ? 4000 + Math.random() * 1500 // 4s - 5.5s
            : 5500 + Math.random() * 3000; // 5.5s - 8.5s

      timerRef.current = setTimeout(scheduleNext, duration);
    };

    timerRef.current = setTimeout(scheduleNext, 5000);

    return () => {
      isCancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mood, isAwake, isMusicPlaying]);

  // Natural spontaneous blinking (only when awake and not in special closed-eye moods)
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;

    const triggerBlink = () => {
      if (isAwake && mood !== 'happy' && mood !== 'love' && mood !== 'wink' && mood !== 'sleepy') {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
        }, 120);
      }

      blinkTimer = setTimeout(triggerBlink, 2200 + Math.random() * 2600);
    };

    blinkTimer = setTimeout(triggerBlink, 2200);
    return () => clearTimeout(blinkTimer);
  }, [isAwake, mood]);

  const isWaving = mood === 'happy' || mood === 'wink' || mood === 'love' || mood === 'bouncy';

  return (
    <div
      className={`relative flex items-center justify-center gap-[6px] h-[20px] select-none pointer-events-none transition-all duration-700 ease-in-out ${
        isAwake
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-75 translate-y-2 pointer-events-none'
      } ${className}`}
      title={`Nusa Companion: ${isAwake ? mood : 'resting'}`}
    >
      {/* Soft Downward Eye Beam Glow */}
      <div className="absolute -bottom-1 w-[46px] h-[8px] bg-white/20 blur-[6px] rounded-full pointer-events-none" />

      {/* LEFT EYE (Block Solid White) */}
      <div
        className={`relative flex items-center justify-center w-[15px] h-[16px] transition-all duration-300 ease-out origin-center ${
          mood === 'curious' ? '-translate-y-[2px] scale-105' : ''
        } ${mood === 'bouncy' ? 'animate-[bounce_0.6s_infinite]' : ''}`}
      >
        {/* Soft vertical light beam under left eye */}
        <div className="absolute top-2 w-[12px] h-[10px] bg-gradient-to-b from-white/25 to-transparent blur-[2px] rounded-b-full pointer-events-none" />

        {isBlinking ? (
          // Blinking slit
          <div className="w-[13px] h-[2px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        ) : mood === 'love' ? (
          // Heart Eye Solid White
          <svg
            viewBox="0 0 16 14"
            className="w-[14px] h-[13px] fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]"
          >
            <path d="M 8 13 C 8 13 1 8.5 1 4 C 1 1.8 2.8 0 5 0 C 6.5 0 7.5 1 8 2 C 8.5 1 9.5 0 11 0 C 13.2 0 15 1.8 15 4 C 15 8.5 8 13 8 13 Z" />
          </svg>
        ) : mood === 'happy' || mood === 'wink' || mood === 'bouncy' ? (
          // Video Arched Happy Eye (^) Solid White
          <svg
            className="w-[15px] h-[12px] overflow-visible drop-shadow-[0_0_7px_rgba(255,255,255,0.9)]"
            viewBox="0 0 16 12"
            fill="none"
          >
            <path
              d="M 2 10 C 2 3.5 14 3.5 14 10"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        ) : mood === 'squint' ? (
          // Focused narrowed bar (- -)
          <div className="w-[13px] h-[3.5px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
        ) : mood === 'sad' ? (
          // Drooping sad eye (\) Solid White
          <svg
            className="w-[15px] h-[12px] overflow-visible drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            viewBox="0 0 16 12"
            fill="none"
          >
            <path
              d="M 2 4 C 6 4 14 10 14 10"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        ) : mood === 'sleepy' ? (
          // Half-closed sleepy eye Solid White
          <div className="w-[14px] h-[6px] bg-white rounded-b-full shadow-[0_0_6px_rgba(255,255,255,0.85)]" />
        ) : (
          // Open Block Solid White Eye (Tanpa Biji Hitam, Bergeser & Bergerak Halus)
          <div
            className={`w-[11px] h-[15px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-200 ease-out origin-center ${
              mood === 'surprised' ? 'scale-[1.25]' : 'scale-100'
            }`}
            style={{
              transform: `translate(${eyeShift.x}px, ${eyeShift.y}px) ${mood === 'surprised' ? 'scale(1.25)' : ''}`,
            }}
          />
        )}
      </div>

      {/* RIGHT EYE (Block Solid White) */}
      <div
        className={`relative flex items-center justify-center w-[15px] h-[16px] transition-all duration-300 ease-out origin-center ${
          mood === 'curious' ? 'translate-y-[1px] rotate-3' : ''
        } ${mood === 'bouncy' ? 'animate-[bounce_0.6s_infinite_0.1s]' : ''}`}
      >
        {/* Soft vertical light beam under right eye */}
        <div className="absolute top-2 w-[12px] h-[10px] bg-gradient-to-b from-white/25 to-transparent blur-[2px] rounded-b-full pointer-events-none" />

        {isBlinking ? (
          // Blinking slit
          <div className="w-[13px] h-[2px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
        ) : mood === 'love' ? (
          // Heart Eye Solid White
          <svg
            viewBox="0 0 16 14"
            className="w-[14px] h-[13px] fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]"
          >
            <path d="M 8 13 C 8 13 1 8.5 1 4 C 1 1.8 2.8 0 5 0 C 6.5 0 7.5 1 8 2 C 8.5 1 9.5 0 11 0 C 13.2 0 15 1.8 15 4 C 15 8.5 8 13 8 13 Z" />
          </svg>
        ) : mood === 'happy' || mood === 'bouncy' ? (
          // Video Arched Happy Eye (^) Solid White
          <svg
            className="w-[15px] h-[12px] overflow-visible drop-shadow-[0_0_7px_rgba(255,255,255,0.9)]"
            viewBox="0 0 16 12"
            fill="none"
          >
            <path
              d="M 2 10 C 2 3.5 14 3.5 14 10"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        ) : mood === 'wink' ? (
          // Wink closed line
          <div className="w-[13px] h-[2px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] rotate-6" />
        ) : mood === 'squint' ? (
          // Focused narrowed bar (- -)
          <div className="w-[13px] h-[3.5px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
        ) : mood === 'sad' ? (
          // Drooping sad eye (/) Solid White
          <svg
            className="w-[15px] h-[12px] overflow-visible drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
            viewBox="0 0 16 12"
            fill="none"
          >
            <path
              d="M 14 4 C 10 4 2 10 2 10"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        ) : mood === 'sleepy' ? (
          // Half-closed sleepy eye Solid White
          <div className="w-[14px] h-[6px] bg-white rounded-b-full shadow-[0_0_6px_rgba(255,255,255,0.85)]" />
        ) : (
          // Open Block Solid White Eye (Tanpa Biji Hitam, Bergeser & Bergerak Halus)
          <div
            className={`w-[11px] h-[15px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-200 ease-out origin-center ${
              mood === 'surprised' ? 'scale-[1.25]' : 'scale-100'
            }`}
            style={{
              transform: `translate(${eyeShift.x}px, ${eyeShift.y}px) ${mood === 'surprised' ? 'scale(1.25)' : ''}`,
            }}
          />
        )}
      </div>

      {/* WAVING PAW / HAND (from Video 82.5s) */}
      <div
        className={`relative ml-[1px] transition-all duration-300 origin-bottom-left ${
          isWaving
            ? 'opacity-100 scale-100 animate-[wave_0.8s_ease-in-out_infinite]'
            : 'opacity-0 scale-75 pointer-events-none'
        }`}
      >
        <svg
          className="w-[13px] h-[13px] overflow-visible drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
          viewBox="0 0 14 14"
          fill="none"
        >
          {/* Main Palm Pad */}
          <path
            d="M 4 8 C 4 6.8 5.2 6 7 6 C 8.8 6 10 6.8 10 8 C 10 9.8 8.8 11.2 7 11.2 C 5.2 11.2 4 9.8 4 8 Z"
            fill="#ffffff"
          />
          {/* 4 Little Finger / Toe Pads */}
          <ellipse cx="4.2" cy="4.5" rx="1.2" ry="1.6" fill="#ffffff" transform="rotate(-15 4.2 4.5)" />
          <ellipse cx="6.1" cy="3.5" rx="1.2" ry="1.7" fill="#ffffff" />
          <ellipse cx="7.9" cy="3.5" rx="1.2" ry="1.7" fill="#ffffff" />
          <ellipse cx="9.8" cy="4.5" rx="1.2" ry="1.6" fill="#ffffff" transform="rotate(15 9.8 4.5)" />
        </svg>
      </div>
    </div>
  );
};
