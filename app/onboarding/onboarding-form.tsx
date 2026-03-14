"use client";
 
import { FormEvent, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveOnboardingCoursesAction } from "./actions";
 
type Course = {
  id: number;
  code: string;
  title: string;
  campus: string;
};
 
const MAX_COURSES = 5;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 30, 40];
const ROW_HEIGHT = 140;
const OVERSCAN_ROWS = 5;
 
export function OnboardingForm({
  courses,
  initialSelectedCourseIds,
}: {
  courses: Course[];
  initialSelectedCourseIds: number[];
}) {
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(initialSelectedCourseIds);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(520);
  const [message, setMessage] = useState<string | null>(null);
  const [submitState, formAction] = useActionState(saveOnboardingCoursesAction, { error: null });
  const virtualListRef = useRef<HTMLDivElement | null>(null);
 
  const selectedCount = selectedCourseIds.length;
  const selectedSet = useMemo(() => new Set(selectedCourseIds), [selectedCourseIds]);
 
  const coursesById = useMemo(() => {
    const map = new Map<number, Course>();
    for (const course of courses) map.set(course.id, course);
    return map;
  }, [courses]);
 
  const normalizedQuery = query.trim().toLowerCase();
 
  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (!normalizedQuery) return true;
        return (
          course.code.toLowerCase().includes(normalizedQuery) ||
          course.title.toLowerCase().includes(normalizedQuery)
        );
      }),
    [courses, normalizedQuery],
  );
 
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
 
  // Reset to page 1 when filters or page size change
  useEffect(() => { setPage(1); }, [pageSize, normalizedQuery]);
 
  // Clamp page if it exceeds total pages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
 
  // Observe container height for virtual list
  useEffect(() => {
    const el = virtualListRef.current;
    if (!el) return;
 
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (typeof height === "number" && height > 0) setContainerHeight(height);
    });
 
    observer.observe(el);
    setContainerHeight(el.clientHeight || 520);
    return () => observer.disconnect();
  }, []);
 
  // Reset scroll on page/filter change
  useEffect(() => {
    const el = virtualListRef.current;
    if (el) el.scrollTop = 0;
    setScrollTop(0);
  }, [page, pageSize, normalizedQuery]);
 
  const startOffset = (page - 1) * pageSize;
  const endOffset = startOffset + pageSize;
  const paginatedCourses = filteredCourses.slice(startOffset, endOffset);
 
  const totalHeight = paginatedCourses.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const endIndex = Math.min(paginatedCourses.length, startIndex + visibleCount);
  const visibleCourses = paginatedCourses.slice(startIndex, endIndex);
 
  const selectedCourses = useMemo(
    () =>
      selectedCourseIds
        .map((id) => coursesById.get(id))
        .filter((course): course is Course => Boolean(course)),
    [coursesById, selectedCourseIds],
  );
 
  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
 
    const numbers = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    while (numbers.size < maxButtons) {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      if (min > 2) numbers.add(min - 1);
      else if (max < totalPages - 1) numbers.add(max + 1);
      else break;
    }
 
    return Array.from(numbers)
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
  }, [page, totalPages]);
 
  function toggleCourse(courseId: number) {
    setMessage(null);
    setSelectedCourseIds((current) => {
      if (current.includes(courseId)) return current.filter((id) => id !== courseId);
      if (current.length >= MAX_COURSES) {
        setMessage(`You can select up to ${MAX_COURSES} courses.`);
        return current;
      }
      return [...current, courseId];
    });
  }
 
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setMessage(null);
 
    if (selectedCourseIds.length === 0) {
      event.preventDefault();
      setMessage("Select at least one course to continue.");
      return;
    }
    if (selectedCourseIds.length > MAX_COURSES) {
      event.preventDefault();
      setMessage(`You can select up to ${MAX_COURSES} courses.`);
      return;
    }
  }
 
  return (
    <form className="mt-6 space-y-6" onSubmit={handleSubmit} action={formAction}>
      {/* Course selection header + search */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Select up to {MAX_COURSES} courses
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCount}/{MAX_COURSES} selected
            </p>
          </div>
          <p className="text-sm text-slate-500">{courses.length} total courses available</p>
        </div>
 
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Search by course code or name
          </span>
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try CSC148 or Introduction to Computer Science"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        </label>
 
        {/* Selected course pills */}
        {selectedCourses.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {selectedCourses.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  onClick={() => toggleCourse(course.id)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-200"
                >
                  {course.code}
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedCourseIds.map((courseId) => (
        <input key={courseId} type="hidden" name="courseId" value={courseId} />
      ))}
 
      {/* Course list */}
      <section className="space-y-4 px-2 sm:px-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing{" "}
            {filteredCourses.length === 0 ? 0 : startOffset + 1}–
            {Math.min(endOffset, filteredCourses.length)} of {filteredCourses.length}
          </p>
 
          <label className="flex items-center gap-3 text-sm text-slate-600">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
 
        {filteredCourses.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No courses match your filters.
          </p>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              ref={virtualListRef}
              className="h-[560px] overflow-y-auto"
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ height: totalHeight, position: "relative" }}>
                {visibleCourses.map((course, localIndex) => {
                  const index = startIndex + localIndex;
                  const checked = selectedSet.has(course.id);
                  const disabled = !checked && selectedCount >= MAX_COURSES;
 
                  return (
                    <label
                      key={course.id}
                      style={{
                        position: "absolute",
                        top: index * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                        padding: "10px 12px",
                      }}
                      className="block"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleCourse(course.id)}
                        className="sr-only"
                      />
                      <div
                        className={`flex h-full items-start justify-between gap-4 rounded-xl border p-4 transition ${
                          checked
                            ? "cursor-pointer border-slate-400 bg-slate-100 text-slate-900 shadow-sm"
                            : disabled
                              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
                              : "cursor-pointer border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold">{course.code}</p>
                          <p className={`mt-1 line-clamp-2 text-sm ${checked ? "text-slate-700" : disabled ? "text-slate-500" : "text-slate-600"}`}>
                            {course.title}
                          </p>
                          <p className={`mt-2 text-xs ${checked ? "text-slate-600" : disabled ? "text-slate-400" : "text-slate-500"}`}>
                            {course.campus}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
 
        {/* Pagination */}
        {filteredCourses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
 
            {pageNumbers.map((pageNumber, index) => {
              const showGap = index > 0 && pageNumber - pageNumbers[index - 1] > 1;
              return (
                <span key={pageNumber} className="flex items-center gap-2">
                  {showGap && <span className="text-sm text-slate-500">...</span>}
                  <button
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                      page === pageNumber
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {pageNumber}
                  </button>
                </span>
              );
            })}
 
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
 
      {message && (
        <p className="text-sm text-rose-600" role="alert">
          {message}
        </p>
      )}

      {submitState.error && (
        <p className="text-sm text-rose-600" role="alert">
          {submitState.error}
        </p>
      )}
 
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending ? "Saving..." : "Continue to group setup"}
    </button>
  );
}
