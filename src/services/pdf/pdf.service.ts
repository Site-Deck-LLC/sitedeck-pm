/**
 * PDF Service
 * ============================================================================
 * Renders SiteDeck-branded PDF documents for RFI, Submittal, and Change Order
 * records. Built on pdfkit (a lightweight, pure-JS PDF library).
 *
 * Output: each builder returns a Node Buffer of a valid PDF.
 *
 * Design tokens (mirrors the SiteDeck design system):
 *   - Navy primary:  #1B2A4A   (header bar)
 *   - Orange accent: #E8720C   (label headings, dividers)
 *   - Gray text:     #444444   (body)
 *   - Muted gray:    #888888   (subdued text)
 *   - Light gray:    #EEEEEE   (table row dividers)
 *
 * Footer page numbers are handled via pdfkit's bufferPageRange / pageAdded.
 * ============================================================================
 */

// pdfkit uses CommonJS export = pattern; we use the namespace import to keep
// the type-only reference. The class is at `PDFKit.PDFDocument` (per the
// @types/pdfkit declaration). We wrap creation in a single helper so the rest
// of the file uses a clean local type.
import * as PDFKit from 'pdfkit';

type PdfDocument = PDFKit.PDFDocument;
type PdfDocumentOptions = PDFKit.PDFDocumentOptions;

function createDoc(options: PdfDocumentOptions): PdfDocument {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (PDFKit as any).PDFDocument || (PDFKit as any).default || PDFKit;
  return new Ctor(options);
}
const COLORS = {
  navy: '#1B2A4A',
  orange: '#E8720C',
  text: '#333333',
  muted: '#888888',
  border: '#E2E4E8',
  lightBg: '#F8F8F8',
};

const MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter at 72dpi
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Collect a PDFKit document into a Buffer. Returns a Promise so callers can
 * await the entire document (which is small — typically 5-15KB).
 */
function collectBuffer(doc: PdfDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Draws the SiteDeck header bar + a section label (e.g. "RFI-2026-0001").
 * Called on every page via the pageAdded event so multi-page PDFs are
 * consistently branded.
 */
function attachHeader(doc: PdfDocument, sectionLabel: string) {
  doc.on('pageAdded', () => {
    drawHeader(doc, sectionLabel);
  });
  drawHeader(doc, sectionLabel);
}

function drawHeader(doc: PdfDocument, sectionLabel: string) {
  // Navy header bar
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, 60).fill(COLORS.navy);

  // Brand text
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('SiteDeck PM', MARGIN, 18);

  // Section label on right
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(sectionLabel, MARGIN, 38, { width: CONTENT_WIDTH, align: 'right' });

  doc.restore();

  // Reset cursor below header
  doc.y = 80;
}

function drawFooter(doc: PdfDocument, docTitle: string) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Thin orange divider
    doc.save();
    doc
      .moveTo(MARGIN, PAGE_HEIGHT - 40)
      .lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 40)
      .lineWidth(0.5)
      .strokeColor(COLORS.orange)
      .stroke();
    doc.restore();

    // Footer text
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Generated ${new Date().toISOString().split('T')[0]} • ${docTitle}`,
        MARGIN,
        PAGE_HEIGHT - 32,
        { width: CONTENT_WIDTH / 2, align: 'left', lineBreak: false }
      );

    doc.text(
      `Page ${i - range.start + 1} of ${totalPages}`,
      MARGIN,
      PAGE_HEIGHT - 32,
      { width: CONTENT_WIDTH, align: 'right', lineBreak: false }
    );
  }
}

function labelValue(doc: PdfDocument, label: string, value: string | null | undefined, x: number, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.orange)
    .text(label.toUpperCase(), x, y, { lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(value || '—', x, y + 12, { width: CONTENT_WIDTH / 2 - 10, lineBreak: true });

  return doc.y;
}

function sectionHeading(doc: PdfDocument, title: string, y: number): number {
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text(title, MARGIN, y);
  // Orange underline
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + 50, doc.y + 2)
    .lineWidth(2)
    .strokeColor(COLORS.orange)
    .stroke();
  return doc.y + 12;
}

function ensureSpace(doc: PdfDocument, needed: number) {
  if (doc.y + needed > PAGE_HEIGHT - 60) {
    doc.addPage();
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toISOString().split('T')[0];
}

// ─── RFI PDF ──────────────────────────────────────────────────────────────────

export interface RfiPdfInput {
  rfiNumber: string;
  subject: string;
  description: string;
  status: string;
  submittedBy: string;
  submittedAt: Date | string | null;
  responseText: string | null;
  answeredAt: Date | string | null;
  projectName: string;
  statusHistory?: { status: string; changedBy: string; changedAt: string }[] | null;
  sourceReference?: string | null;
  requiredDate?: Date | string | null;
  ballInCourt?: string | null;
}

export async function buildRfiPdf(data: RfiPdfInput): Promise<Buffer> {
  const doc = createDoc({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  attachHeader(doc, `RFI: ${data.rfiNumber}`);

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.navy)
    .text(`RFI ${data.rfiNumber}`, MARGIN, doc.y);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.projectName, MARGIN, doc.y + 2);

  doc.y += 20;
  let y = doc.y;

  // Status + dates row (2 columns)
  y = labelValue(doc, 'Status', data.status, MARGIN, y);
  y = labelValue(doc, 'Submitted By', data.submittedBy, MARGIN + CONTENT_WIDTH / 2, y - 24);

  y = labelValue(doc, 'Submitted', formatDate(data.submittedAt), MARGIN, y);
  y = labelValue(doc, 'Required By', formatDate(data.requiredDate), MARGIN + CONTENT_WIDTH / 2, y - 24);

  y = labelValue(doc, 'Ball In Court', data.ballInCourt, MARGIN, y);
  y = labelValue(doc, 'Source Reference', data.sourceReference, MARGIN + CONTENT_WIDTH / 2, y - 24);

  doc.y = y + 12;

  // Subject section
  ensureSpace(doc, 60);
  doc.y = sectionHeading(doc, 'Subject', doc.y);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(data.subject, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.y += 12;

  // Description section
  ensureSpace(doc, 80);
  doc.y = sectionHeading(doc, 'Description', doc.y);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(data.description || 'No description provided.', MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.y += 12;

  // Response section
  ensureSpace(doc, 60);
  doc.y = sectionHeading(doc, 'Response', doc.y);
  if (data.responseText) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(data.responseText, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`Answered ${formatDate(data.answeredAt)}`, MARGIN, doc.y + 4);
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(data.ballInCourt ? `Awaiting response from ${data.ballInCourt}` : 'No response yet', MARGIN, doc.y);
  }

  doc.y += 12;

  // Status history
  if (data.statusHistory && data.statusHistory.length > 0) {
    ensureSpace(doc, 60);
    doc.y = sectionHeading(doc, 'Status History', doc.y);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.text);

    for (const h of data.statusHistory) {
      doc.text(
        `• ${h.status} — ${formatDate(h.changedAt)} by ${h.changedBy || 'system'}`,
        MARGIN + 8,
        doc.y,
        { width: CONTENT_WIDTH - 8 }
      );
    }
  }

  drawFooter(doc, `RFI ${data.rfiNumber}`);
  return collectBuffer(doc);
}

// ─── Submittal PDF ───────────────────────────────────────────────────────────

export interface SubmittalPdfInput {
  submittalNumber: string;
  title: string;
  description: string | null;
  status: string;
  specSection: string | null;
  submittedBy: string;
  submittedAt: Date | string | null;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewComments: string | null;
  requiredDate?: Date | string | null;
  projectName: string;
  statusHistory?: { status: string; changedBy: string; changedAt: string }[] | null;
}

export async function buildSubmittalPdf(data: SubmittalPdfInput): Promise<Buffer> {
  const doc = createDoc({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  attachHeader(doc, `Submittal: ${data.submittalNumber}`);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.navy)
    .text(`Submittal ${data.submittalNumber}`, MARGIN, doc.y);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.projectName, MARGIN, doc.y + 2);

  doc.y += 20;
  let y = doc.y;

  y = labelValue(doc, 'Status', data.status, MARGIN, y);
  y = labelValue(doc, 'Spec Section', data.specSection, MARGIN + CONTENT_WIDTH / 2, y - 24);

  y = labelValue(doc, 'Submitted By', data.submittedBy, MARGIN, y);
  y = labelValue(doc, 'Submitted', formatDate(data.submittedAt), MARGIN + CONTENT_WIDTH / 2, y - 24);

  y = labelValue(doc, 'Required By', formatDate(data.requiredDate), MARGIN, y);
  y = labelValue(doc, 'Reviewed By', data.reviewedBy, MARGIN + CONTENT_WIDTH / 2, y - 24);

  doc.y = y + 12;

  // Title section
  ensureSpace(doc, 60);
  doc.y = sectionHeading(doc, 'Title', doc.y);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(data.title, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.y += 12;

  // Description
  if (data.description) {
    ensureSpace(doc, 60);
    doc.y = sectionHeading(doc, 'Description', doc.y);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(data.description, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.y += 12;
  }

  // Review
  ensureSpace(doc, 60);
  doc.y = sectionHeading(doc, 'Review', doc.y);
  if (data.reviewComments) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(data.reviewComments, MARGIN, doc.y, { width: CONTENT_WIDTH });
    if (data.reviewedAt) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(`Reviewed by ${data.reviewedBy || '—'} on ${formatDate(data.reviewedAt)}`, MARGIN, doc.y + 4);
    }
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text('No review comments yet.', MARGIN, doc.y);
  }

  doc.y += 12;

  // Status history
  if (data.statusHistory && data.statusHistory.length > 0) {
    ensureSpace(doc, 60);
    doc.y = sectionHeading(doc, 'Status History', doc.y);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    for (const h of data.statusHistory) {
      doc.text(
        `• ${h.status} — ${formatDate(h.changedAt)} by ${h.changedBy || 'system'}`,
        MARGIN + 8,
        doc.y,
        { width: CONTENT_WIDTH - 8 }
      );
    }
  }

  drawFooter(doc, `Submittal ${data.submittalNumber}`);
  return collectBuffer(doc);
}

// ─── Change Order PDF ────────────────────────────────────────────────────────

export interface ChangeOrderPdfInput {
  coNumber: string;
  date: Date | string;
  description: string;
  status: string;
  dollarValue: number | null;
  scheduleImpact: number | null;
  approver: string | null;
  approvedAt: Date | string | null;
  projectName: string;
  affectedActivityIds?: string[] | null;
}

export async function buildChangeOrderPdf(data: ChangeOrderPdfInput): Promise<Buffer> {
  const doc = createDoc({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  attachHeader(doc, `Change Order: ${data.coNumber}`);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.navy)
    .text(`Change Order ${data.coNumber}`, MARGIN, doc.y);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.projectName, MARGIN, doc.y + 2);

  doc.y += 20;
  let y = doc.y;

  y = labelValue(doc, 'Status', data.status, MARGIN, y);
  y = labelValue(doc, 'Date', formatDate(data.date), MARGIN + CONTENT_WIDTH / 2, y - 24);

  y = labelValue(
    doc,
    'Dollar Value',
    data.dollarValue !== null ? `$${data.dollarValue.toLocaleString()}` : '—',
    MARGIN,
    y
  );
  y = labelValue(
    doc,
    'Schedule Impact',
    data.scheduleImpact !== null ? `${data.scheduleImpact} hours` : '—',
    MARGIN + CONTENT_WIDTH / 2,
    y - 24
  );

  y = labelValue(doc, 'Approver', data.approver, MARGIN, y);
  y = labelValue(doc, 'Decision Date', formatDate(data.approvedAt), MARGIN + CONTENT_WIDTH / 2, y - 24);

  doc.y = y + 12;

  // Description
  ensureSpace(doc, 60);
  doc.y = sectionHeading(doc, 'Scope Change', doc.y);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(data.description, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.y += 12;

  // Affected activities
  if (data.affectedActivityIds && data.affectedActivityIds.length > 0) {
    ensureSpace(doc, 60);
    doc.y = sectionHeading(doc, `Affected Activities (${data.affectedActivityIds.length})`, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    for (const id of data.affectedActivityIds) {
      doc.text(`• ${id}`, MARGIN + 8, doc.y, { width: CONTENT_WIDTH - 8 });
    }
  }

  drawFooter(doc, `Change Order ${data.coNumber}`);
  return collectBuffer(doc);
}

// ─── Submittal Log PDF (multi-page) ──────────────────────────────────────────

export interface SubmittalLogRow {
  submittalNumber: string;
  specSection: string | null;
  title: string;
  status: string;
  submittedAt: Date | string | null;
  requiredDate: Date | string | null;
  daysOpen: number;
}

export async function buildSubmittalLogPdf(
  submittals: SubmittalLogRow[],
  projectName: string
): Promise<Buffer> {
  const doc = createDoc({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  attachHeader(doc, 'Submittal Log');

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(COLORS.navy)
    .text('Submittal Log', MARGIN, doc.y);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(projectName, MARGIN, doc.y + 2);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`${submittals.length} submittal${submittals.length !== 1 ? 's' : ''}`, MARGIN, doc.y + 2, { align: 'right', width: CONTENT_WIDTH });

  doc.y += 20;

  if (submittals.length === 0) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(11)
      .fillColor(COLORS.muted)
      .text('No submittals on record for this project.', MARGIN, doc.y);
    drawFooter(doc, 'Submittal Log');
    return collectBuffer(doc);
  }

  // Table column layout
  const colWidths = {
    number: 90,
    spec: 70,
    title: 180,
    status: 80,
    submitted: 75,
    required: 60,
    days: 25,
  };

  const drawTableHeader = (y: number) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLORS.orange);

    let x = MARGIN;
    doc.text('NUMBER', x, y, { width: colWidths.number, lineBreak: false }); x += colWidths.number;
    doc.text('SPEC', x, y, { width: colWidths.spec, lineBreak: false }); x += colWidths.spec;
    doc.text('TITLE', x, y, { width: colWidths.title, lineBreak: false }); x += colWidths.title;
    doc.text('STATUS', x, y, { width: colWidths.status, lineBreak: false }); x += colWidths.status;
    doc.text('SUBMITTED', x, y, { width: colWidths.submitted, lineBreak: false }); x += colWidths.submitted;
    doc.text('REQUIRED', x, y, { width: colWidths.required, lineBreak: false }); x += colWidths.required;
    doc.text('DAYS', x, y, { width: colWidths.days, lineBreak: false });

    // Divider
    doc
      .moveTo(MARGIN, y + 14)
      .lineTo(MARGIN + CONTENT_WIDTH, y + 14)
      .lineWidth(0.5)
      .strokeColor(COLORS.orange)
      .stroke();

    return y + 18;
  };

  let y = drawTableHeader(doc.y);

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);

  for (const s of submittals) {
    const rowHeight = 16;
    if (y + rowHeight > PAGE_HEIGHT - 60) {
      doc.addPage();
      y = drawTableHeader(doc.y);
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    }

    let x = MARGIN;
    doc.text(s.submittalNumber, x, y, { width: colWidths.number, lineBreak: false }); x += colWidths.number;
    doc.text(s.specSection || '—', x, y, { width: colWidths.spec, lineBreak: false }); x += colWidths.spec;
    doc.text(s.title, x, y, { width: colWidths.title, lineBreak: false, ellipsis: true }); x += colWidths.title;
    doc.text(s.status, x, y, { width: colWidths.status, lineBreak: false }); x += colWidths.status;
    doc.text(formatDate(s.submittedAt), x, y, { width: colWidths.submitted, lineBreak: false }); x += colWidths.submitted;
    doc.text(formatDate(s.requiredDate), x, y, { width: colWidths.required, lineBreak: false }); x += colWidths.required;

    const daysColor = s.daysOpen > 30 ? '#C9372D' : s.daysOpen > 7 ? '#D68A00' : COLORS.text;
    doc.fillColor(daysColor).text(`${s.daysOpen}`, x, y, { width: colWidths.days, lineBreak: false });
    doc.fillColor(COLORS.text);

    // Row separator
    doc
      .moveTo(MARGIN, y + rowHeight - 2)
      .lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight - 2)
      .lineWidth(0.25)
      .strokeColor(COLORS.border)
      .stroke();

    y += rowHeight;
  }

  drawFooter(doc, 'Submittal Log');
  return collectBuffer(doc);
}

// ─── Owner Report PDF ────────────────────────────────────────────────────────

export interface OwnerReportPdfInput {
  reportTitle: string;
  weekEnding: string;
  projectName: string;
  generatedAt: string;
  sections: {
    schedule: string;
    cost: string;
    rfis: string;
    change_orders: string;
    risks: string;
    lookahead: string;
  };
  metrics?: {
    cpi?: number;
    spi?: number;
    pctComplete?: number;
    activeRfis?: number;
    overdueRfis?: number;
    openChangeOrders?: number;
    approvedChangeOrders?: number;
  } | null;
}

export async function buildOwnerReportPdf(data: OwnerReportPdfInput): Promise<Buffer> {
  const doc = createDoc({ size: 'LETTER', margin: MARGIN, bufferPages: true });
  attachHeader(doc, `Owner Report — ${data.weekEnding}`);

  // Cover
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(COLORS.navy)
    .text('Weekly Owner Report', MARGIN, 120);

  doc
    .font('Helvetica')
    .fontSize(14)
    .fillColor(COLORS.text)
    .text(data.projectName, MARGIN, 160);

  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(COLORS.muted)
    .text(`Week ending ${data.weekEnding}`, MARGIN, 184);

  // Big orange divider
  doc
    .moveTo(MARGIN, 220)
    .lineTo(MARGIN + 100, 220)
    .lineWidth(3)
    .strokeColor(COLORS.orange)
    .stroke();

  // Executive summary box — headline metrics (if provided)
  if (data.metrics) {
    doc.y = 250;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.navy)
      .text('EXECUTIVE SUMMARY', MARGIN, doc.y);
    doc.y += 16;

    const cards: Array<{ label: string; value: string; color?: string }> = [];
    if (data.metrics.cpi !== undefined) {
      cards.push({ label: 'CPI', value: data.metrics.cpi.toFixed(2), color: data.metrics.cpi >= 1 ? COLORS.navy : '#C9372D' });
    }
    if (data.metrics.spi !== undefined) {
      cards.push({ label: 'SPI', value: data.metrics.spi.toFixed(2), color: data.metrics.spi >= 1 ? COLORS.navy : '#C9372D' });
    }
    if (data.metrics.pctComplete !== undefined) {
      cards.push({ label: '% COMPLETE', value: `${Math.round(data.metrics.pctComplete * 100)}%` });
    }
    if (data.metrics.activeRfis !== undefined) {
      cards.push({ label: 'ACTIVE RFIs', value: String(data.metrics.activeRfis) });
    }
    if (data.metrics.overdueRfis !== undefined) {
      cards.push({
        label: 'OVERDUE RFIs',
        value: String(data.metrics.overdueRfis),
        color: data.metrics.overdueRfis > 0 ? '#C9372D' : COLORS.navy,
      });
    }
    if (data.metrics.openChangeOrders !== undefined) {
      cards.push({ label: 'OPEN COs', value: String(data.metrics.openChangeOrders) });
    }
    if (data.metrics.approvedChangeOrders !== undefined) {
      cards.push({ label: 'APPROVED COs', value: String(data.metrics.approvedChangeOrders), color: '#22A06B' });
    }

    const cardWidth = CONTENT_WIDTH / Math.max(cards.length, 1);
    let cx = MARGIN;
    for (const c of cards) {
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(c.color || COLORS.navy)
        .text(c.value, cx, doc.y, { width: cardWidth - 8, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(c.label, cx, doc.y + 4, { width: cardWidth - 8, lineBreak: false });
      cx += cardWidth;
    }
    doc.y += 38;
  } else {
    doc.y = 250;
  }

  // Section renderer
  const writeSection = (title: string, body: string) => {
    if (!body) return;
    ensureSpace(doc, 80);
    doc.y = sectionHeading(doc, title, doc.y);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(body, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
    doc.y += 14;
  };

  doc.addPage();
  writeSection('Schedule', data.sections.schedule);
  writeSection('Cost', data.sections.cost);
  writeSection('RFIs', data.sections.rfis);
  writeSection('Change Orders', data.sections.change_orders);
  writeSection('Risks', data.sections.risks);
  writeSection('Two-Week Lookahead', data.sections.lookahead);

  drawFooter(doc, `Owner Report — Week ending ${data.weekEnding}`);
  return collectBuffer(doc);
}
