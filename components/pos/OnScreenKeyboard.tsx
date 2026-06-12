"use client";

import { useState } from "react";
import { ArrowBigUp, Delete } from "lucide-react";

interface OnScreenKeyboardProps {
  value: string;
  onChange: (next: string) => void;
}

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
];

/** Touch on-screen keyboard for devices without a native software keyboard. */
export default function OnScreenKeyboard({ value, onChange }: OnScreenKeyboardProps) {
  const [shift, setShift] = useState(false);

  function press(key: string) {
    const isLetter = /[a-zñ]/i.test(key);
    onChange(value + (shift && isLetter ? key.toUpperCase() : key));
    if (shift) setShift(false);
  }

  const keyClass =
    "flex-1 h-12 min-w-0 rounded-lg bg-white border border-gray-200 text-base font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 transition-all";

  return (
    <div className="select-none space-y-1.5 rounded-xl bg-gray-100 p-2">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} className={keyClass}>
              {shift && /[a-zñ]/i.test(k) ? k.toUpperCase() : k}
            </button>
          ))}
        </div>
      ))}

      {/* Bottom control row */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setShift((s) => !s)}
          className={`h-12 px-4 rounded-lg border text-sm font-bold flex items-center justify-center active:scale-95 transition-all ${
            shift
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <ArrowBigUp size={20} />
        </button>
        <button
          type="button"
          onClick={() => onChange(value + " ")}
          className="flex-1 h-12 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
        >
          Espacio
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          className="h-12 px-5 rounded-lg bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}
