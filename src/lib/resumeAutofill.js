// Resume parsing runs in the recruiter's browser. Nothing is uploaded for parsing.
export function extractContactFields(text) {
  const normalized = text.replace(/\u00a0/g, " ");
  const email = normalized.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
  const phone = (normalized.match(/(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g) || [])[0] || "";
  const lines = normalized.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const name = lines.slice(0, 8).find(line => /^[A-Za-z][A-Za-z'’.-]+(?:\s+[A-Za-z][A-Za-z'’.-]+){1,3}$/.test(line) && !/^(professional|resume|curriculum|work experience|contact information|summary|education|skills)$/i.test(line)) || "";
  return { name, email, phone };
}
export async function readResumeText(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 10485760) throw new Error("Resume must be under 10 MB.");
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const lines = [];
        let lastY = null;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform?.[5];
          if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 3) lines.push("\n");
          lines.push(item.str + " ");
          if (y !== undefined) lastY = y;
        }
        pages.push(lines.join(""));
      }
    } finally { await pdf.destroy(); }
    return pages.join("\n");
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (ext === "doc") throw new Error("Older .doc resumes can still be attached, but automatic extraction requires PDF or DOCX.");
  throw new Error("Select a PDF, DOC, or DOCX resume.");
}
