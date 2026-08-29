// Verify parseDocument logic + real libraries in Node CJS (compatible with unpdf/mammoth ESM workers).
const fs = require("fs");
const path = require("path");
const { getDocumentProxy, extractText } = require("unpdf");
const mammoth = require("mammoth");

const MIN_EXTRACTED_TEXT_CHARS = 400;
const ARTICLE_TEXT_CHAR_BUDGET = 10000;
function limitText(s, n) { return s.length > n ? s.slice(0, n) : s; }

async function parseDocument(fileName, fileData) {
  if (!/^[A-Za-z0-9 _.\\-]+\.(pdf|docx)$/i.test(fileName)) {
    throw new Error("Unsupported file type. Upload a PDF or .docx file.");
  }
  let buffer;
  try { buffer = Buffer.from(fileData, "base64"); } catch { throw new Error("File data is not valid base64."); }
  if (buffer.length > 3_000_000) throw new Error("File is too large (max 3 MB).");

  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const text = (typeof result.text === "string" ? result.text : "").trim();
    if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
      throw new Error("This PDF has no selectable text (it appears to be a scanned image). OCR is not supported yet.");
    }
    return { title: fileName, text: limitText(text, ARTICLE_TEXT_CHAR_BUDGET) };
  }
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? "").trim();
  if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
    throw new Error("This document has no extractable text.");
  }
  return { title: fileName, text: limitText(text, ARTICLE_TEXT_CHAR_BUDGET) };
}

async function main() {
  const fx = path.join(__dirname, "..", "tests/fixtures");
  const pdf = fs.readFileSync(path.join(fx, "sample.pdf"));
  const docx = fs.readFileSync(path.join(fx, "sample.docx"));
  let pass = 0, fail = 0;
  const check = (n, c, e="") => { if (c) { pass++; console.log("PASS:", n); } else { fail++; console.log("FAIL:", n, e); } };

  try {
    const r = await parseDocument("sample.pdf", pdf.toString("base64"));
    check("pdf parses", r.text.includes("renewable energy transition"), JSON.stringify(r.text.slice(0,40)));
    check("pdf title", r.title === "sample.pdf");
  } catch (e) { check("pdf parses", false, e.message); }

  try {
    const r = await parseDocument("sample.docx", docx.toString("base64"));
    check("docx parses", r.text.includes("renewable energy transition"), JSON.stringify(r.text.slice(0,40)));
  } catch (e) { check("docx parses", false, e.message); }

  try { await parseDocument("notes.txt", Buffer.from("x").toString("base64")); check("txt rejected", false); }
  catch (e) { check("txt rejected", /Unsupported/.test(e.message), e.message); }

  const big = Buffer.alloc(3_200_000, 1);
  try { await parseDocument("big.pdf", big.toString("base64")); check("oversized rejected", false); }
  catch (e) { check("oversized rejected", /too large/.test(e.message), e.message); }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
