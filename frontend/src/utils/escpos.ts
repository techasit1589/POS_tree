/**
 * ESC/POS command builder สำหรับ Thermal Printer 58mm / 80mm
 * ใช้ส่งผ่าน Web Bluetooth API
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// จำนวนตัวอักษรต่อบรรทัดตามขนาดกระดาษ
export const PAPER_CHARS: Record<string, number> = {
  '58mm': 32,
  '80mm': 48,
};

export type PaperSize = '58mm' | '80mm';

export class EscPos {
  private buf: number[] = [];

  // ── Initialization ──
  init(): this {
    this.push(ESC, 0x40);
    return this;
  }

  // ── Alignment ──
  center(): this { this.push(ESC, 0x61, 0x01); return this; }
  left(): this   { this.push(ESC, 0x61, 0x00); return this; }
  right(): this  { this.push(ESC, 0x61, 0x02); return this; }

  // ── Text Style ──
  boldOn(): this  { this.push(ESC, 0x45, 0x01); return this; }
  boldOff(): this { this.push(ESC, 0x45, 0x00); return this; }

  /** ขนาดตัวอักษร: width/height 1-8 */
  textSize(width: 1 | 2, height: 1 | 2): this {
    const n = ((width - 1) << 4) | (height - 1);
    this.push(GS, 0x21, n);
    return this;
  }
  textNormal(): this { this.push(GS, 0x21, 0x00); return this; }

  // ── Lines ──
  lf(): this { this.push(LF); return this; }

  /** พิมพ์เส้นแบ่ง */
  line(char = '-', cols = 32): this {
    return this.println(char.repeat(cols));
  }

  // ── Text ──
  text(str: string): this {
    const bytes = new TextEncoder().encode(str);
    bytes.forEach((b) => this.buf.push(b));
    return this;
  }

  println(str: string): this { return this.text(str).lf(); }

  /** จัดข้อความสองฝั่ง ซ้าย-ขวา */
  printRow(leftText: string, rightText: string, cols: number): this {
    const leftBytes = this.measureBytes(leftText);
    const rightBytes = this.measureBytes(rightText);
    const spaces = Math.max(1, cols - leftBytes - rightBytes);
    return this.text(leftText).text(' '.repeat(spaces)).println(rightText);
  }

  // ── Cut ──
  cut(): this { this.push(GS, 0x56, 0x01); return this; }

  // ── Build ──
  build(): Uint8Array {
    return new Uint8Array(this.buf);
  }

  // ── Private helpers ──
  private push(...bytes: number[]): void {
    bytes.forEach((b) => this.buf.push(b));
  }

  /**
   * นับความกว้างของ string เป็น bytes
   * ASCII = 1, Thai/non-ASCII = 2-3 bytes แต่พิมพ์กว้าง 1 char
   */
  private measureBytes(str: string): number {
    // ใช้ length เพื่อความง่าย (นับ character ไม่ใช่ byte)
    return [...str].length;
  }
}

/** สร้างใบเสร็จ ESC/POS จาก order data */
export function buildReceipt(opts: {
  shopName: string;
  shopSubtitle?: string;
  thankYouMessage?: string;
  receiptNumber: string;
  customerName?: string;
  dateStr: string;
  timeStr: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  total: number;
  note?: string;
  paperSize: PaperSize;
}): Uint8Array {
  const cols = PAPER_CHARS[opts.paperSize] ?? 32;
  const sep = '-'.repeat(cols);
  const doc = new EscPos().init();

  // ── Header ──
  doc.center();
  doc.boldOn().textSize(1, 2);
  doc.println(opts.shopName);
  doc.boldOff().textNormal();
  if (opts.shopSubtitle) doc.println(opts.shopSubtitle);
  doc.lf();

  // ── Receipt Info ──
  doc.left();
  doc.println(sep);
  doc.println(`เลขที่ : ${opts.receiptNumber}`);
  doc.println(`วันที่ : ${opts.dateStr}  ${opts.timeStr}`);
  if (opts.customerName) doc.println(`ลูกค้า : ${opts.customerName}`);
  doc.println(sep);

  // ── Items ──
  doc.println(truncate('รายการ', cols - 8).padEnd(cols - 8) + 'ราคา'.padStart(8));
  doc.println(sep);

  for (const item of opts.items) {
    const nameQty = `${item.name} x${item.quantity}`;
    const subtotalStr = formatPrice(item.subtotal);
    doc.printRow(truncate(nameQty, cols - subtotalStr.length - 1), subtotalStr, cols);

    if (item.quantity > 1) {
      doc.println(`  (${formatPrice(item.unitPrice)} x ${item.quantity})`);
    }
  }

  // ── Total ──
  doc.println(sep);
  doc.boldOn();
  doc.printRow('รวมทั้งสิ้น', formatPrice(opts.total), cols);
  doc.boldOff();

  // ── Note ──
  if (opts.note) {
    doc.println(sep);
    doc.println(`หมายเหตุ: ${opts.note}`);
  }

  // ── Footer ──
  doc.println(sep);
  doc.center();
  if (opts.thankYouMessage) {
    // ตัด emoji ออก (อาจทำให้ printer error)
    doc.println(stripEmoji(opts.thankYouMessage));
  } else {
    doc.println('ขอบคุณที่ใช้บริการ');
  }
  doc.lf().lf().lf();
  doc.cut();

  return doc.build();
}

// ── Helpers ──

function formatPrice(n: number): string {
  return `${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}B`;
}

function truncate(str: string, maxLen: number): string {
  const chars = [...str];
  return chars.length > maxLen ? chars.slice(0, maxLen - 1).join('') + '.' : str;
}

function stripEmoji(str: string): string {
  return str.replace(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    '',
  ).trim();
}
