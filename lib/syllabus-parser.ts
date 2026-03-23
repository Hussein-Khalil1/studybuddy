// PDF text extraction + date/event parsing for syllabus auto-population

export type ExtractedEvent = {
  title:     string;
  dueDate:   string;        // YYYY-MM-DD
  prepDate:  string | null; // YYYY-MM-DD
  eventType: "assignment" | "exam" | "quiz" | "other";
  isFlagged: boolean;
};

const MONTH_MAP: Record<string, number> = {
  january:0, february:1, march:2, april:3, may:4, june:5,
  july:6, august:7, september:8, october:9, november:10, december:11,
  jan:0, feb:1, mar:2, apr:3, jun:5, jul:6,
  aug:7, sep:8, oct:9, nov:10, dec:11,
};

function toDateStr(year: number, month: number, day: number): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(year, month, day);
  if (d.getMonth() !== month || d.getDate() !== day) return null; // rolled over
  return d.toISOString().split("T")[0];
}

function prepDate(dueDate: string, type: ExtractedEvent["eventType"]): string {
  const days = type === "exam" ? 7 : type === "quiz" ? 2 : 3;
  const d = new Date(dueDate + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function detectType(text: string): ExtractedEvent["eventType"] {
  const t = text.toLowerCase();
  if (/\b(exam|midterm|final|test)\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\b(assignment|homework|\bhw\b|project|paper|report|lab|submit|due)\b/.test(t)) return "assignment";
  return "other";
}

function cleanTitle(raw: string, removedSpan: string): string {
  let s = raw.replace(removedSpan, " ").replace(/\s+/g, " ").trim();
  // Remove common noise prefixes
  s = s.replace(/^[-–:|•·,]+\s*/u, "").replace(/\s*[-–:|•·,]+$/u, "").trim();
  if (s.length < 3) s = raw.replace(/\s+/g, " ").trim();
  return s.substring(0, 195);
}

function parseDate(line: string, baseYear: number): { dateStr: string; span: string } | null {
  // Pattern 1: "January 15, 2026" / "Jan 15 2026"
  const p1 = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/gi;
  // Pattern 2: "15 January 2026"
  const p2 = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{4})?\b/gi;
  // Pattern 3: MM/DD/YYYY
  const p3 = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  // Pattern 4: YYYY-MM-DD
  const p4 = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;

  let m: RegExpExecArray | null;

  m = p1.exec(line);
  if (m) {
    const monthKey = m[1].toLowerCase().substring(0, 3) === "may" ? "may" : m[1].toLowerCase().replace(/\.$/, "").substring(0, 3);
    const month = MONTH_MAP[m[1].toLowerCase()] ?? MONTH_MAP[monthKey];
    const day = parseInt(m[2]);
    const year = m[3] ? parseInt(m[3]) : baseYear;
    const d = toDateStr(year, month!, day);
    if (d) return { dateStr: d, span: m[0] };
  }

  m = p2.exec(line);
  if (m) {
    const month = MONTH_MAP[m[2].toLowerCase()] ?? MONTH_MAP[m[2].toLowerCase().substring(0, 3)];
    const day = parseInt(m[1]);
    const year = m[3] ? parseInt(m[3]) : baseYear;
    const d = toDateStr(year, month!, day);
    if (d) return { dateStr: d, span: m[0] };
  }

  m = p3.exec(line);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const d = toDateStr(year, parseInt(m[1]) - 1, parseInt(m[2]));
    if (d) return { dateStr: d, span: m[0] };
  }

  m = p4.exec(line);
  if (m) {
    const d = toDateStr(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    if (d) return { dateStr: d, span: m[0] };
  }

  return null;
}

export function extractEvents(pdfText: string): ExtractedEvent[] {
  const today = new Date();
  const baseYear = today.getFullYear();
  const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const events: ExtractedEvent[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const context = [lines[i - 1] ?? "", line, lines[i + 1] ?? ""].join(" ");
    const parsed = parseDate(line, baseYear);
    if (!parsed) continue;

    const { dateStr, span } = parsed;
    const title = cleanTitle(line, span) || context.substring(0, 100).trim();
    const type  = detectType(context);
    const key   = `${dateStr}|${title.toLowerCase().substring(0, 40)}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const dueD  = new Date(dateStr + "T00:00:00");
    // Flag if date is in the past by more than 30 days (might be wrong year)
    const isFlagged = dueD.getTime() < today.getTime() - 30 * 86400000;

    events.push({
      title:     title.length >= 3 ? title : "Untitled Event",
      dueDate:   dateStr,
      prepDate:  prepDate(dateStr, type),
      eventType: type,
      isFlagged,
    });
  }

  return events.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import avoids bundling issues with pdf-parse
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text as string;
  } catch {
    return "";
  }
}
