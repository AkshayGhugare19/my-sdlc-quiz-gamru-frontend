import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import endpoints from '../services/api.js';
import { RESOURCE_CONFIGS, QUESTION_TYPES } from '../config/resourceConfigs.jsx';
import ResourceTable from '../components/ResourceTable.jsx';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { Spinner, useToast } from '../components/ui.jsx';
import { useAuthStore } from '../store/authStore.js';

// ── Question Bank page: the generic CRUD table + bulk Excel import. ──────────
// The template is a real .xlsx workbook; uploads accept .xlsx/.xls/.csv (all
// parsed by SheetJS). Every row goes through the NORMAL question endpoint, so
// option validation (≥2 options, exactly one correct) is exactly the same as
// creating questions by hand — no separate code path to drift.

// Rows the template workbook ships with. `type` = one of the question types
// (blank = SINGLE_CHOICE). `correct` = 1-based option number (1 = option1) or
// the exact text of the correct option; multi-answer types (e.g.
// MULTIPLE_CHOICE) accept a comma-separated list like "1,3".
const TEMPLATE_ROWS = [
  ['prompt', 'type', 'category', 'difficulty', 'points', 'explanation', 'option1', 'option2', 'option3', 'option4', 'correct'],
  ['Which gas is the largest contributor to global warming?', 'SINGLE_CHOICE', 'Environment', 'MEDIUM', 10, 'Carbon dioxide (CO2) is the main greenhouse gas.', 'Carbon dioxide (CO2)', 'Oxygen', 'Nitrogen', 'Helium', 1],
  ['Which of the following are renewable sources of energy?', 'MULTIPLE_CHOICE', 'Environment', 'EASY', 10, 'Solar and wind are renewable.', 'Solar', 'Coal', 'Wind', 'Natural gas', '1,3'],
  ['What does the "3Rs" principle stand for?', 'SINGLE_CHOICE', 'Environment', 'EASY', 10, 'Reduce, Reuse, Recycle.', 'Reduce Reuse Recycle', 'Read Write Repeat', 'Run Rest Repeat', 'Rate Review Return', 1],
  ['The ozone layer protects Earth from UV rays.', 'TRUE_FALSE', 'Environment', 'MEDIUM', 10, 'The ozone layer absorbs most UV radiation.', 'True', 'False', '', '', 1],
];

/** Build the template .xlsx workbook (with comfortable column widths). */
function buildTemplateWorkbook() {
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  ws['!cols'] = [
    { wch: 55 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 7 }, { wch: 45 },
    { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  return wb;
}

// Types where exactly ONE option may be correct (mirrors the backend rule).
const SINGLE_ANSWER_TYPES = ['SINGLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'TIMED_QUESTION', 'VIDEO_QUESTION'];

// One sheet row → the exact payload the question form would submit.
function rowToPayload(header, cells, lineNo) {
  const get = (name) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? String(cells[idx] ?? '').trim() : '';
  };
  const prompt = get('prompt');
  if (!prompt) throw new Error(`Row ${lineNo}: "prompt" is required`);

  // Question type: optional column, defaults to SINGLE_CHOICE. Forgiving input
  // ("multiple choice" / "multiple-choice" → MULTIPLE_CHOICE), strict output.
  const typeRaw = get('type');
  const type = typeRaw ? typeRaw.toUpperCase().replace(/[\s-]+/g, '_') : 'SINGLE_CHOICE';
  if (!QUESTION_TYPES.includes(type)) {
    throw new Error(`Row ${lineNo}: unknown type "${typeRaw}" — use one of: ${QUESTION_TYPES.join(', ')}`);
  }

  const optionLabels = [];
  for (let n = 1; n <= 6; n++) {
    const v = get(`option${n}`);
    if (v) optionLabels.push(v);
  }
  if (optionLabels.length < 2) throw new Error(`Row ${lineNo}: needs at least option1 and option2`);

  const correctRaw = get('correct');
  if (!correctRaw) throw new Error(`Row ${lineNo}: "correct" is required (option number or exact option text)`);
  // Multi-answer types accept a comma/semicolon separated list ("1,3" or texts).
  const correctIdxs = new Set();
  for (const token of correctRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    let idx = -1;
    if (/^\d+$/.test(token)) {
      idx = Number(token) - 1; // 1-based in the sheet
    } else {
      idx = optionLabels.findIndex((l) => l.toLowerCase() === token.toLowerCase());
    }
    if (idx < 0 || idx >= optionLabels.length) {
      throw new Error(`Row ${lineNo}: "correct" (${token}) doesn't match any option`);
    }
    correctIdxs.add(idx);
  }
  if (correctIdxs.size === 0) throw new Error(`Row ${lineNo}: "correct" is required`);
  if (SINGLE_ANSWER_TYPES.includes(type) && correctIdxs.size > 1) {
    throw new Error(`Row ${lineNo}: ${type} allows exactly one correct option — "correct" has ${correctIdxs.size}`);
  }

  return {
    prompt,
    type,
    category: get('category') || undefined,
    difficulty: get('difficulty') ? get('difficulty').toUpperCase() : undefined,
    points: Number(get('points')) > 0 ? Number(get('points')) : 10,
    explanation: get('explanation') || undefined,
    options: optionLabels.map((label, i) => ({ label, isCorrect: correctIdxs.has(i) })),
  };
}

function ImportModal({ open, onClose, onImported }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { created, failed: [{line, error}] }

  const downloadTemplate = () => {
    XLSX.writeFile(buildTemplateWorkbook(), 'question-import-template.xlsx');
  };

  const importFile = async (file) => {
    setBusy(true);
    setResult(null);
    try {
      // SheetJS reads .xlsx, .xls and .csv alike — first worksheet is the data.
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('The workbook has no sheets — download the template to see the format.');
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      if (rows.length < 2) throw new Error('The sheet has no data rows — download the template to see the format.');
      const header = rows[0].map((h) => String(h).trim().toLowerCase());
      if (!header.includes('prompt') || !header.includes('option1') || !header.includes('correct')) {
        throw new Error('Missing required columns — the header row must include: prompt, option1, option2, correct.');
      }

      let created = 0;
      const failed = [];
      // Sequential on purpose: keeps server load tiny and error lines readable.
      for (let i = 1; i < rows.length; i++) {
        const lineNo = i + 1;
        try {
          const payload = rowToPayload(header, rows[i], lineNo);
          await endpoints.questions.create(payload);
          created++;
        } catch (e) {
          failed.push({ line: lineNo, error: e.message });
        }
      }
      setResult({ created, failed });
      if (created > 0) {
        toast(`${created} question${created === 1 ? '' : 's'} imported`);
        onImported();
      }
      if (created === 0 && failed.length > 0) toast('No questions imported — check the errors below', 'error');
    } catch (e) {
      setResult({ created: 0, failed: [{ line: '-', error: e.message }] });
      toast(e.message, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Questions from Excel"
      subtitle="Fill the .xlsx template and upload it — each row becomes one question with its options"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <ol className="text-sm text-white/70 space-y-1.5 list-decimal list-inside">
          <li>
            <button onClick={downloadTemplate} className="text-neon font-semibold hover:underline">
              Download the example sheet (.xlsx)
            </button>{' '}
            and open it in Excel.
          </li>
          <li>
            One question per row: <span className="font-mono text-xs text-white/60">prompt</span>, optional{' '}
            <span className="font-mono text-xs text-white/60">type / category / difficulty / points / explanation</span>, up
            to 6 options (<span className="font-mono text-xs text-white/60">option1…option6</span>).
          </li>
          <li>
            <span className="font-mono text-xs text-white/60">type</span> = the question type (e.g.{' '}
            <span className="font-mono text-xs text-white/60">SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE</span>) — blank
            defaults to SINGLE_CHOICE.
          </li>
          <li>
            <span className="font-mono text-xs text-white/60">correct</span> = the option number (1&nbsp;=&nbsp;option1)
            or the exact option text. Multi-answer types take a comma-separated list, e.g.{' '}
            <span className="font-mono text-xs text-white/60">1,3</span>.
          </li>
          <li>Save and upload the Excel file here (.xlsx, .xls and .csv all work).</li>
        </ol>
        <p className="text-xs text-white/40">
          Tip: give rows the same <span className="text-white/60">category</span> you use on missions — a mission picks
          up all questions of its category automatically.
        </p>

        <label
          className={`block rounded-2xl border-2 border-dashed border-white/15 hover:border-neon/50 transition px-6 py-8 text-center cursor-pointer ${
            busy ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          {busy ? (
            <span className="inline-flex items-center gap-2 text-neon font-semibold">
              <Spinner className="w-5 h-5" /> Importing…
            </span>
          ) : (
            <>
              <div className="text-3xl mb-1">📊</div>
              <div className="text-sm font-semibold text-white/80">Click to choose your Excel sheet</div>
              <div className="text-xs text-white/40 mt-0.5">.xlsx / .xls / .csv — question-import-template format</div>
            </>
          )}
        </label>

        {result && (
          <div className="rounded-xl bg-black/20 border border-white/10 p-4 text-sm space-y-2">
            <div className="font-semibold text-white/85">
              ✅ {result.created} imported
              {result.failed.length > 0 && <span className="text-red-300"> · ⚠️ {result.failed.length} failed</span>}
            </div>
            {result.failed.length > 0 && (
              <ul className="text-xs text-red-300/90 space-y-1 max-h-40 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    Line {f.line}: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Questions() {
  const canCreate = useAuthStore((s) => s.can('questions', 'create'));
  const [importOpen, setImportOpen] = useState(false);
  // Bumping the key remounts the table so freshly imported rows show up.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <ResourceTable
        key={reloadKey}
        {...RESOURCE_CONFIGS.questions}
        resource="questions"
        headerExtras={
          canCreate ? (
            <button onClick={() => setImportOpen(true)} className="btn-ghost flex items-center gap-2">
              <Icon name="upload" className="w-4 h-4" />
              Import Sheet
            </button>
          ) : null
        }
      />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setReloadKey((k) => k + 1)}
      />
    </>
  );
}
