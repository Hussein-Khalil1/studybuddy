"use client";

import { useState } from "react";

export type CalendarAssignment = {
  id: number;
  title: string;
  due_date: string | null;
  course_code: string;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

function getStatus(due: string): "overdue"|"soon"|"normal" {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(due+"T00:00:00");
  const diff = Math.floor((d.getTime()-today.getTime())/86400000);
  if (diff<0) return "overdue";
  if (diff<7) return "soon";
  return "normal";
}

function calendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const days: Date[] = [];
  for (let i=first-1; i>=0; i--) days.push(new Date(year, month-1, prevDays-i));
  for (let d=1; d<=daysInMonth; d++) days.push(new Date(year, month, d));
  const rem = 42 - days.length;
  for (let d=1; d<=rem; d++) days.push(new Date(year, month+1, d));
  return days;
}

export function CalendarClient({ assignments }: { assignments: CalendarAssignment[] }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(dateKey(now));

  function prevMonth() {
    if (month===0) { setYear(y=>y-1); setMonth(11); } else setMonth(m=>m-1);
  }
  function nextMonth() {
    if (month===11) { setYear(y=>y+1); setMonth(0); } else setMonth(m=>m+1);
  }
  function goToday() {
    setYear(now.getFullYear()); setMonth(now.getMonth()); setSelected(dateKey(now));
  }

  // Map due_date → assignments
  const byDate = new Map<string, CalendarAssignment[]>();
  for (const a of assignments) {
    if (!a.due_date) continue;
    if (!byDate.has(a.due_date)) byDate.set(a.due_date, []);
    byDate.get(a.due_date)!.push(a);
  }

  const days = calendarDays(year, month);

  // Selected day detail
  const selectedAssignments = selected ? (byDate.get(selected) ?? []) : [];
  const selectedDate = selected ? new Date(selected+"T00:00:00") : null;

  return (
    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.07)]">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f2eeec] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h2 className="text-base font-bold text-[#2a2028] min-w-[160px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f2eeec] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[rgba(194,112,138,0.4)] text-[#c2708a] hover:bg-[rgba(194,112,138,0.06)] transition-colors"
        >
          Today
        </button>
      </div>

      {/* ── Day-of-week labels ── */}
      <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.07)]">
        {DAY_LABELS.map((d,i) => (
          <div
            key={d}
            className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wider ${
              i===0||i===6 ? "text-[rgba(42,32,40,0.3)]" : "text-[rgba(42,32,40,0.4)]"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key         = dateKey(day);
          const isCurrentMo = day.getMonth()===month && day.getFullYear()===year;
          const today       = isToday(day);
          const isSelected  = selected===key;
          const events      = byDate.get(key) ?? [];
          const hasEvents   = events.length>0;
          const isLastRow   = idx >= 35;
          const isLastCol   = (idx+1)%7===0;

          // Status dot colour for events
          const dotColor = hasEvents
            ? events.some(e=>getStatus(e.due_date!)===  "overdue") ? "bg-red-400"
            : events.some(e=>getStatus(e.due_date!)==="soon")    ? "bg-amber-400"
            : "bg-[#c2708a]"
            : "";

          return (
            <button
              key={key+idx}
              onClick={() => setSelected(isSelected ? null : key)}
              className={[
                "relative flex flex-col items-center pt-2 pb-3 gap-1 transition-colors focus:outline-none",
                !isLastRow ? "border-b border-[rgba(0,0,0,0.06)]" : "",
                !isLastCol ? "border-r border-[rgba(0,0,0,0.06)]" : "",
                isSelected
                  ? "bg-[rgba(194,112,138,0.06)]"
                  : "hover:bg-[#faf8f7]",
              ].join(" ")}
            >
              {/* Day number */}
              <span
                className={[
                  "w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors",
                  today
                    ? "bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white font-bold shadow-sm"
                    : isSelected
                    ? "bg-[rgba(194,112,138,0.15)] text-[#c2708a] font-bold"
                    : isCurrentMo
                    ? "text-[#2a2028] font-medium"
                    : "text-[rgba(42,32,40,0.22)] font-normal",
                ].join(" ")}
              >
                {day.getDate()}
              </span>

              {/* Event dot */}
              {hasEvents && (
                <div className="flex gap-[3px]">
                  {events.slice(0,3).map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor} ${!isCurrentMo ? "opacity-30" : ""}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Day detail panel ── */}
      {selected && (
        <div className="border-t border-[rgba(0,0,0,0.07)]">
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#faf8f7]">
            <p className="text-sm font-semibold text-[#2a2028]">
              {selectedDate?.toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-[rgba(42,32,40,0.35)] hover:text-[#2a2028] transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Assignments for selected day */}
          {selectedAssignments.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-[rgba(42,32,40,0.4)]">No assignments due on this day.</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(0,0,0,0.05)]">
              {selectedAssignments.map((a) => {
                const status = getStatus(a.due_date!);
                return (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-4">
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${
                      status==="overdue" ? "bg-red-400"
                      : status==="soon"  ? "bg-amber-400"
                      : "bg-gradient-to-b from-[#c2708a] to-[#9b6ba5]"
                    }`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2a2028]">{a.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                          {a.course_code}
                        </span>
                        {status==="overdue" && <span className="text-[11px] font-semibold text-red-500">Overdue</span>}
                        {status==="soon"    && <span className="text-[11px] font-semibold text-amber-600">Due soon</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── No assignments at all ── */}
      {assignments.length===0 && !selected && (
        <div className="px-6 py-10 text-center border-t border-[rgba(0,0,0,0.06)]">
          <p className="text-sm text-[rgba(42,32,40,0.4)]">
            No assignments yet. Click any day to see details.
          </p>
        </div>
      )}
    </div>
  );
}
