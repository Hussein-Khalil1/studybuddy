"use client";

import { useState, useTransition } from "react";
import { setShowPointsAction } from "./actions";

export function PrivacyToggle({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const res = await setShowPointsAction(next);
      if (!res.ok) setEnabled(!next); // revert on error
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#2a2028]">Show points &amp; badges</p>
        <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5">
          {enabled
            ? "Group members can see your points and badges"
            : "Your points and badges are hidden from others"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-6 ${
          enabled ? "bg-gradient-to-r from-[#c2708a] to-[#9b6ba5]" : "bg-[rgba(0,0,0,0.12)]"
        } ${isPending ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
