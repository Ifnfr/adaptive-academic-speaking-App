// Regenerate test fixtures: docx via jszip (mammoth-validated), pdf via pdf-lib (unpdf-parseable).
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { PDFDocument } = require("pdf-lib");

const TEXT = "The renewable energy transition requires careful grid planning. Solar and wind reduce emissions but need storage to balance supply. Grid operators must manage variability through battery storage, demand response, and interconnection upgrades. Policy incentives accelerate deployment, yet land use and supply chains remain constraints. A just transition protects workers in fossil industries while building new clean energy jobs. Modelling shows that combining renewables with firm low-carbon capacity improves reliability. International cooperation on technology transfer helps developing economies leapfrog carbon-intensive infrastructure.";

async function main() {
  const dir = "tests/fixtures";
  fs.mkdirSync(dir, { recursive: true });

  const zip = new JSZip();
  zip.file("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>');
  zip.file("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>');
  zip.file("word/document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t xml:space="preserve">' + TEXT + '</w:t></w:r></w:p></w:body></w:document>');
  zip.file("word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="document.xml"/>' +
    '</Relationships>');
  const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(path.join(dir, "sample.docx"), docxBuf);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const sentences = TEXT.match(/[^.!?]+[.!?]+/g) || [TEXT];
  let y = 750;
  for (const s of sentences) {
    page.drawText(s.trim(), { x: 50, y, size: 12, maxWidth: 500 });
    y -= 20;
  }
  const pdfBuf = Buffer.from(await pdfDoc.save());
  fs.writeFileSync(path.join(dir, "sample.pdf"), pdfBuf);

  console.log("docx bytes:", docxBuf.length, "pdf bytes:", pdfBuf.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
