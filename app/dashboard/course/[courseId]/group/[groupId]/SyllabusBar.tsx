"use client";

import { useRef, useState, useTransition } from "react";
import { uploadSyllabusAction, getSyllabusDownloadUrl } from "./syllabus-actions";

type ExistingSyllabus = {
  fileName: string;
  eventsExtracted: number;
  uploadedAt: string;
  uploaderName: string;
} | null;

export function SyllabusBar({
  groupId,
  courseId,
  existing,
}: {
  groupId: number;
  courseId: number;
  existing: ExistingSyllabus;
}) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus]   = useState<"idle" | "confirm" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type !== "application/pdf") {
      setStatus("error"); setMessage("Only PDF files allowed."); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("error"); setMessage("File must be under 20 MB."); return;
    }

    if (existing) {
      // Warn before overwrite
      setPendingFile(file);
      setStatus("confirm");
    } else {
      doUpload(file);
    }
  }

  function doUpload(file: File) {
    setStatus("idle");
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("groupId", String(groupId));
      fd.append("courseId", String(courseId));

      const result = await uploadSyllabusAction(fd);
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error ?? "Upload failed.");
      } else {
        setStatus("success");
        setMessage(
          result.eventsExtracted === 0
            ? `${result.fileName} uploaded. No dates were auto-extracted.`
            : `${result.fileName} uploaded · ${result.eventsExtracted} event${result.eventsExtracted !== 1 ? "s" : ""} added to calendar.`
        );
        setPendingFile(null);
      }
    });
  }

  async function onDownload() {
    setDownloading(true);
    const url = await getSyllabusDownloadUrl(groupId);
    setDownloading(false);
    if (url) window.open(url, "_blank");
    else { setStatus("error"); setMessage("Could not generate download link."); }
  }

  return (
    <div className="border-b border-[rgba(0,0,0,0.07)] bg-[#faf8f7] px-4 py-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Confirm overwrite */}
      {status === "confirm" && pendingFile && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[#2a2028]">
            A syllabus already exists. Overwrite with <span className="font-semibold">{pendingFile.name}</span>?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { setStatus("idle"); setPendingFile(null); }}
              className="text-xs px-3 py-1 rounded-lg border border-[rgba(0,0,0,0.1)] text-[rgba(42,32,40,0.6)] hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => doUpload(pendingFile)}
              className="text-xs px-3 py-1 rounded-lg bg-[#c2708a] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {isPending && (
        <div className="flex items-center gap-2 text-xs text-[rgba(42,32,40,0.6)]">
          <svg className="animate-spin w-3.5 h-3.5 shrink-0 text-[#c2708a]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <span>Uploading &amp; parsing syllabus…</span>
        </div>
      )}

      {/* Success */}
      {!isPending && status === "success" && (
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>{message}</span>
          </div>
          <button onClick={() => setStatus("idle")} className="text-[10px] text-[rgba(42,32,40,0.4)] hover:underline">dismiss</button>
        </div>
      )}

      {/* Error */}
      {!isPending && status === "error" && (
        <div className="flex items-center justify-between flex-wrap gap-1">
          <p className="text-xs text-red-500">{message}</p>
          <button onClick={() => setStatus("idle")} className="text-[10px] text-[rgba(42,32,40,0.4)] hover:underline">dismiss</button>
        </div>
      )}

      {/* Normal state */}
      {!isPending && status === "idle" && (
        <div className="flex items-center justify-between gap-3">
          {existing ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                {/* PDF icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2708a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#2a2028] truncate">{existing.fileName}</p>
                  <p className="text-[10px] text-[rgba(42,32,40,0.45)]">
                    Uploaded by {existing.uploaderName}
                    {existing.eventsExtracted > 0 && ` · ${existing.eventsExtracted} events`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onDownload}
                  disabled={downloading}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[rgba(0,0,0,0.1)] text-[rgba(42,32,40,0.6)] hover:bg-white transition-colors disabled:opacity-50"
                >
                  {downloading ? "…" : "View"}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[rgba(0,0,0,0.1)] text-[rgba(42,32,40,0.6)] hover:bg-white transition-colors"
                >
                  Replace
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(42,32,40,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p className="text-xs text-[rgba(42,32,40,0.5)]">No syllabus uploaded yet</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white hover:opacity-90 transition-opacity shrink-0"
              >
                Upload Syllabus PDF
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
