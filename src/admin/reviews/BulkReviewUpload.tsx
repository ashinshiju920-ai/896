import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Star,
  Loader2,
  X,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Book, ExamCategory, Review } from "../../types";

interface ParsedRow {
  rowIndex: number;
  name: string;
  review: string;
  rating: number;
  errors: string[];
}

interface BulkReviewUploadProps {
  books: Book[];
  onUpdateBook: (bookId: string, updated: Partial<Book>) => boolean | Promise<boolean>;
  showToast: (message: string, type?: "success" | "info" | "warning") => void;
}

const CATEGORIES: ExamCategory[] = ["IELTS", "OET", "PTE", "German", "Mock Test"];

const CATEGORY_COLOR: Record<string, string> = {
  IELTS: "bg-blue-100 text-blue-800",
  OET: "bg-purple-100 text-purple-800",
  PTE: "bg-amber-100 text-amber-800",
  German: "bg-green-100 text-green-800",
  "Mock Test": "bg-rose-100 text-rose-800",
};

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "review", "rating"],
    ["Anjana Mohan", "The IELTS material was incredibly comprehensive. Helped me score Band 8.5!", 5],
    ["Karthik Nair", "Great practice tests. Very aligned with actual exam questions.", 4],
    ["Priya Suresh", "Excellent vocabulary sections. Achieved my target score in the first attempt.", 5],
  ]);
  ws["!cols"] = [{ wch: 25 }, { wch: 70 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reviews");
  XLSX.writeFile(wb, "bulk_reviews_template.xlsx");
}

function parseRows(rawRows: any[][]): ParsedRow[] {
  let headerIdx = 0;
  let nameCol = 0, reviewCol = 1, ratingCol = 2;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const row = rawRows[i].map((c: any) => String(c || "").toLowerCase().trim());
    const ni = row.findIndex((c) => c === "name");
    const ri = row.findIndex((c) => c === "review" || c === "comment");
    const rti = row.findIndex((c) => c === "rating" || c === "stars");
    if (ni !== -1 && ri !== -1) {
      headerIdx = i + 1;
      nameCol = ni; reviewCol = ri;
      ratingCol = rti !== -1 ? rti : 2;
      break;
    }
  }
  return rawRows.slice(headerIdx).map((row, idx): ParsedRow => {
    const name = String(row[nameCol] ?? "").trim();
    const review = String(row[reviewCol] ?? "").trim();
    const rawRating = parseFloat(String(row[ratingCol] ?? "5"));
    const rating = isNaN(rawRating) ? 5 : Math.round(Math.min(5, Math.max(1, rawRating)));
    const errors: string[] = [];
    if (!name) errors.push("Name missing");
    if (!review) errors.push("Review missing");
    if (isNaN(rawRating) || rawRating < 1 || rawRating > 5) errors.push("Rating should be 1-5");
    return { rowIndex: headerIdx + idx + 1, name, review, rating, errors };
  }).filter((r) => r.name || r.review);
}

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
    ))}
  </div>
);

function computeAverageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((s, r) => s + (r.rating || 5), 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export const BulkReviewUpload: React.FC<BulkReviewUploadProps> = ({ books, onUpdateBook, showToast }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"select" | "preview" | "publishing" | "done">("select");
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory>("IELTS");
  const [minRating, setMinRating] = useState(3);
  const [maxRating, setMaxRating] = useState(5);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [publishResult, setPublishResult] = useState<{ success: number; failed: number } | null>(null);

  const categoryBooks = books.filter((b) => b.category === selectedCategory && b.active !== false);

  const effectiveRows = parsedRows
    .filter((r) => r.errors.length === 0)
    .map((r) => ({ ...r, rating: Math.min(maxRating, Math.max(minRating, r.rating)) }));

  const starDist = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: effectiveRows.filter((r) => r.rating === s).length,
  }));

  const invalidRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const rows = parseRows(rawRows);
        if (rows.length === 0) { showToast("No data found in file.", "warning"); return; }
        setParsedRows(rows);
        setStep("preview");
      } catch { showToast("Could not parse file. Please use the template format.", "warning"); }
    };
    reader.readAsArrayBuffer(file);
  }, [showToast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handlePublish = async () => {
    if (effectiveRows.length === 0) { showToast("No valid rows to publish.", "warning"); return; }
    if (categoryBooks.length === 0) { showToast(`No active products found in "${selectedCategory}".`, "warning"); return; }
    setStep("publishing");
    const dateStr = new Date().toISOString().split("T")[0];
    const newReviews: Review[] = effectiveRows.map((r, i) => ({
      id: `bulk_${selectedCategory.replace(/\s+/g, "_")}_${Date.now()}_${i}`,
      author: r.name, rating: r.rating, comment: r.review,
      verified: true, date: dateStr, bandOrScore: "",
    }));
    let successCount = 0, failCount = 0;
    for (const book of categoryBooks) {
      const existing = Array.isArray(book.reviews) ? book.reviews : [];
      const updatedReviews = mode === "replace" ? newReviews : [...existing, ...newReviews];
      const saved = await onUpdateBook(book.id, {
        reviews: updatedReviews,
        reviewCount: updatedReviews.length,
        rating: computeAverageRating(updatedReviews),
      });
      if (saved) successCount++; else failCount++;
    }
    setPublishResult({ success: successCount, failed: failCount });
    setStep("done");
    showToast(`${newReviews.length} reviews published to ${successCount} product(s) in ${selectedCategory}`, "success");
  };

  const handleReset = () => { setStep("select"); setFileName(""); setParsedRows([]); setPublishResult(null); };

  // ── Step 1: Select & Upload ──
  if (step === "select") {
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-2 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Target Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selectedCategory === cat ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">{categoryBooks.length} active product{categoryBooks.length !== 1 ? "s" : ""} will receive these reviews</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Star Range</label>
            <div className="space-y-2">
              {[{ label: "Min", val: minRating, set: (v: number) => setMinRating(Math.min(v, maxRating)) }, { label: "Max", val: maxRating, set: (v: number) => setMaxRating(Math.max(v, minRating)) }].map(({ label, val, set }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 w-8">{label}</span>
                  <input type="range" min={1} max={5} value={val} onChange={(e) => set(parseInt(e.target.value))} className="flex-1 accent-emerald-600" />
                  <span className="text-xs font-bold text-slate-700 w-4 text-right">{val}★</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">Ratings outside range are clamped</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Upload Mode</label>
            <div className="space-y-2">
              {(["append", "replace"] as const).map((m) => (
                <label key={m} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 accent-emerald-600" />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 capitalize">{m}</span>
                    <p className="text-[10px] text-slate-400">{m === "append" ? "Add to existing reviews" : "Replace all existing reviews in category"}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${isDragging ? "border-emerald-500 bg-emerald-50/60" : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"}`}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-emerald-100" : "bg-slate-100"}`}>
            <FileSpreadsheet className={`w-8 h-8 ${isDragging ? "text-emerald-600" : "text-slate-400"}`} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-800">{isDragging ? "Drop your file here" : "Drop Excel / CSV here, or click to browse"}</p>
            <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv &bull; Columns: name, review, rating</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors ${isDragging ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"}`}>
            <Upload className="w-3.5 h-3.5" />Choose File
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">Need a template?</p>
              <p className="text-[11px] text-blue-600">Download the pre-formatted Excel file with example rows</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0">
            <Download className="w-3.5 h-3.5" />Download Template
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Preview ──
  if (step === "preview") {
    const avgRating = effectiveRows.length > 0
      ? (effectiveRows.reduce((s, r) => s + r.rating, 0) / effectiveRows.length).toFixed(1) : "-";
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{ label: "File", value: fileName, small: true }, { label: "Valid Rows", value: String(effectiveRows.length), accent: "text-emerald-700" }, { label: "Invalid", value: String(invalidRows.length), accent: invalidRows.length > 0 ? "text-rose-600" : "text-slate-400" }, { label: "Avg Rating", value: `${avgRating} ★`, accent: "text-amber-600" }].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{s.label}</p>
              <p className={`font-extrabold truncate ${s.accent ?? "text-slate-900"} ${s.small ? "text-xs" : "text-sm"}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Configuration</h4>
              <div className="space-y-2 text-xs">
                {[{ l: "Category", v: <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${CATEGORY_COLOR[selectedCategory] ?? "bg-slate-100 text-slate-700"}`}>{selectedCategory}</span> }, { l: "Products affected", v: <span className="font-bold text-slate-800">{categoryBooks.length}</span> }, { l: "Star range", v: <span className="font-bold text-slate-800">{minRating}★ – {maxRating}★</span> }, { l: "Mode", v: <span className={`font-bold capitalize ${mode === "replace" ? "text-rose-600" : "text-emerald-700"}`}>{mode}</span> }].map(({ l, v }) => (
                  <div key={l} className="flex justify-between items-center"><span className="text-slate-500">{l}</span>{v}</div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Star Distribution (after clamping)</h4>
              <div className="space-y-1.5">
                {starDist.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 w-4">{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: effectiveRows.length ? `${(count / effectiveRows.length) * 100}%` : "0%" }} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            {invalidRows.length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-800">{invalidRows.length} rows will be skipped</p>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {invalidRows.slice(0, 5).map((r) => (
                    <p key={r.rowIndex} className="text-[10px] text-amber-700">Row {r.rowIndex}: {r.errors.join(", ")}</p>
                  ))}
                  {invalidRows.length > 5 && <p className="text-[10px] text-amber-600">...and {invalidRows.length - 5} more</p>}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">Preview — First {Math.min(effectiveRows.length, 20)} valid rows</h4>
              <span className="text-[11px] text-slate-400">{effectiveRows.length} total valid</span>
            </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["#", "Name", "Review", "Rating"].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {effectiveRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 text-[10px]">{i + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{r.name}</td>
                      <td className="px-4 py-2.5 text-slate-600 leading-relaxed max-w-xs"><span className="line-clamp-2">{r.review}</span></td>
                      <td className="px-4 py-2.5"><StarRow rating={r.rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {effectiveRows.length > 20 && <div className="px-4 py-3 text-center text-[11px] text-slate-400 border-t border-slate-50">+ {effectiveRows.length - 20} more rows</div>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />Cancel
          </button>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {mode === "replace" && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />Replace mode: existing reviews in {selectedCategory} will be overwritten
              </div>
            )}
            <button onClick={handlePublish} disabled={effectiveRows.length === 0 || categoryBooks.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm">
              <Layers className="w-3.5 h-3.5" />
              Publish {effectiveRows.length} Reviews &rarr; {categoryBooks.length} Product{categoryBooks.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Publishing ──
  if (step === "publishing") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-900">Publishing reviews...</p>
          <p className="text-xs text-slate-400">Writing {effectiveRows.length} reviews across {categoryBooks.length} {selectedCategory} product{categoryBooks.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
    );
  }

  // ── Step 4: Done ──
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-in fade-in duration-200">
      <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-extrabold text-slate-900">Bulk Upload Complete!</h3>
        <p className="text-sm text-slate-500">
          {effectiveRows.length} reviews published to{" "}
          <span className={`font-bold px-2 py-0.5 rounded text-xs ${CATEGORY_COLOR[selectedCategory] ?? "bg-slate-100 text-slate-700"}`}>{selectedCategory}</span>
        </p>
      </div>
      {publishResult && (
        <div className="flex gap-4">
          <div className="text-center bg-emerald-50 border border-emerald-200 rounded-2xl px-8 py-4">
            <p className="text-2xl font-extrabold text-emerald-700">{publishResult.success}</p>
            <p className="text-xs text-emerald-600 font-semibold">Products updated</p>
          </div>
          {publishResult.failed > 0 && (
            <div className="text-center bg-rose-50 border border-rose-200 rounded-2xl px-8 py-4">
              <p className="text-2xl font-extrabold text-rose-600">{publishResult.failed}</p>
              <p className="text-xs text-rose-500 font-semibold">Failed</p>
            </div>
          )}
        </div>
      )}
      <button onClick={handleReset}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
        <RefreshCw className="w-3.5 h-3.5" />Upload Another Batch
      </button>
    </div>
  );
};
