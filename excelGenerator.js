// excelGenerator.js
// Generates Excel reports matching LECSA Botha-Bothe treasurer format exactly.
// Uses ExcelJS (npm install exceljs).

const ExcelJS = require('exceljs');

// ─── Colours ────────────────────────────────────────────────────────────────
const COLOR = {
  headerBg:    'FFB8860B',  // dark-golden (matches camel brand)
  headerFont:  'FFFFFFFF',
  subheaderBg: 'FFDDDDDD',
  totalBg:     'FFF5F5F5',
  incomeGreen: 'FF006400',
  expenseRed:  'FF8B0000',
  titleFont:   'FF000000',
  altRow:      'FFFAFAF5',
};

// ─── INCOME categories (columns in Ledger sheet) ────────────────────────────
const INCOME_CATS = [
  'New Year', 'Moaho (Sunday Collection)', 'Kabelo', 'Pitso / Khopotso',
  'Thuthuho', 'Mokotla I', 'Mokotla II', 'T.B.', 'Baptismal Cards',
  'Almanaka', 'Leselinyana', 'Pledge (Boitlamo)', 'Others',
];

// ─── EXPENSE categories (columns in Ledger sheet) ───────────────────────────
const EXPENSE_CATS = [
  'Lijo (Food)', 'Transport', 'Allowances', 'Morutuoa', 'Phone',
  'WASCO', 'LEC', 'Maintenance', 'Stationery', 'Konsistori',
  'Other', 'Seabo', 'Ntlafatso',
];

const CHURCHES = ['BBC', 'BB MOPELI', 'MAKONG', 'LIKHUTLONG'];

// Map our DB category names → Ledger column names
const INCOME_MAP = {
  'KABELO':     'Kabelo',
  'PITSO':      'Pitso / Khopotso',
  'THUTHUHO':   'Thuthuho',
  'MOKOTLA I':  'Mokotla I',
  'MOKOTLA II': 'Mokotla II',
  'MEKETE':     'Others',
  'MEA HO':     'Moaho (Sunday Collection)',
  'BOITLAMO':   'Pledge (Boitlamo)',
  'BOSHOME':    'T.B.',
  'TLHOEKISO':  'Others',
  'BALISA':     'Others',
  'NTLAFATSO':  'Others',
  'BOIKHUTSO':  'Others',
  'TLATSETSO':  'Others',
};

const EXPENSE_MAP = {
  'LIJO':         'Lijo (Food)',
  'TRANSPORT':    'Transport',
  'ALLOWANCES':   'Allowances',
  'MORUTUOA':     'Morutuoa',
  'PHONE':        'Phone',
  'WASCO':        'WASCO',
  'LEC':          'LEC',
  'MAINTENANCE':  'Maintenance',
  'STATIONERY':   'Stationery',
  'KONSISTORI':   'Konsistori',
  'OTHER':        'Other',
  'SEABO':        'Seabo',
  'NTLAFATSO':    'Ntlafatso',
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function styleHeader(cell, bg = COLOR.headerBg, fgColor = COLOR.headerFont) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font = { bold: true, color: { argb: fgColor }, name: 'Arial', size: 10 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
}

function styleTotal(cell, color = COLOR.titleFont) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.totalBg } };
  cell.font = { bold: true, color: { argb: color }, name: 'Arial', size: 10 };
  cell.border = {
    top: { style: 'thin' }, bottom: { style: 'double' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
}

function styleData(cell, row, isAlt = false) {
  cell.font = { name: 'Arial', size: 10 };
  if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.altRow } };
  cell.border = {
    top: { style: 'hair' }, bottom: { style: 'hair' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };
}

function numFmt(cell) {
  cell.numFmt = '#,##0.00';
  cell.alignment = { horizontal: 'right' };
}

function titleRow(ws, text, cols) {
  ws.addRow([]);
  const row = ws.lastRow;
  ws.mergeCells(row.number, 1, row.number, cols);
  const c = row.getCell(1);
  c.value = text;
  c.font = { bold: true, name: 'Arial', size: 12, color: { argb: COLOR.titleFont } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 20;
}

// ─── Month names ─────────────────────────────────────────────────────────────
const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const MONTHS_SS = ['JAN','FEB','MAR','APR','MAY','JUN',
                   'JUL','AUG','SEP','OCT','NOV','DEC'];

// ════════════════════════════════════════════════════════════════════════════
// 1. WEEKLY LEDGER  (LEDGER_ACCOUNT_SPEC format)
// ════════════════════════════════════════════════════════════════════════════
async function generateWeeklyReport(transactions, weekStart) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LECSA Botha-Bothe Financial System';

  const d = new Date(weekStart);
  const monthName = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const ws = wb.addWorksheet(`${monthName.substring(0,3)} ${year}`);

  // Title
  const totalCols = 2 + INCOME_CATS.length + 1 + EXPENSE_CATS.length + 2; // DATE + CHURCH + inc + TOTAL + exp + Total + Banking
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `INCOME AND EXPENDITURE ACCOUNTS  BOTHA BOTHE LECSA ${year}`;
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 22;

  // Row 2: Month header + section labels
  ws.getRow(2).height = 18;
  ws.getCell(2, 1).value = `${monthName} ${year}`;
  ws.getCell(2, 1).font = { bold: true, name: 'Arial', size: 11 };
  const incomeStart = 3;
  const incomeEnd = incomeStart + INCOME_CATS.length - 1;
  const incomeTotalCol = incomeEnd + 1;
  const expenseStart = incomeTotalCol + 1;
  const expenseEnd = expenseStart + EXPENSE_CATS.length - 1;
  const expenseTotalCol = expenseEnd + 1;
  const bankingCol = expenseTotalCol + 1;

  ws.mergeCells(2, incomeStart, 2, incomeTotalCol);
  ws.getCell(2, incomeStart).value = 'INCOME';
  styleHeader(ws.getCell(2, incomeStart), 'FF006400');

  ws.mergeCells(2, expenseStart, 2, bankingCol);
  ws.getCell(2, expenseStart).value = 'EXPENSES';
  styleHeader(ws.getCell(2, expenseStart), 'FF8B0000');

  // Row 3: Column headers
  ws.getRow(3).height = 30;
  const headers = ['DATE', 'KEREKANA (Church)',
    ...INCOME_CATS, 'TOTAL (Income)',
    ...EXPENSE_CATS, 'Total (Expenses)', 'Banking'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    styleHeader(cell);
  });

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 16;
  for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 12;

  // ── Group transactions by date → church
  const weeks = {};
  transactions.forEach(t => {
    const dk = t.week_start;
    if (!weeks[dk]) weeks[dk] = {};
    const church = (t.church || 'UNKNOWN').toUpperCase();
    if (!weeks[dk][church]) weeks[dk][church] = { income: {}, expense: {} };
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      const col = INCOME_MAP[t.category] || 'Others';
      weeks[dk][church].income[col] = (weeks[dk][church].income[col] || 0) + amt;
    } else {
      const col = EXPENSE_MAP[t.category] || 'Other';
      weeks[dk][church].expense[col] = (weeks[dk][church].expense[col] || 0) + amt;
    }
  });

  let rowNum = 4;
  const sortedWeeks = Object.keys(weeks).sort();
  sortedWeeks.forEach((wk, wi) => {
    const isFirstWeek = wi === 0;
    const churchData = weeks[wk];
    const totals = { income: {}, expense: {} };

    // Each church row
    CHURCHES.forEach((ch, ci) => {
      const data = churchData[ch] || { income: {}, expense: {} };
      const row = ws.getRow(rowNum++);
      row.height = 16;

      // DATE only on first church of this week
      if (ci === 0) {
        const dateCell = row.getCell(1);
        dateCell.value = new Date(wk);
        dateCell.numFmt = 'DD-MMM-YYYY';
        dateCell.font = { bold: true, name: 'Arial', size: 10 };
      }

      row.getCell(2).value = ch;
      row.getCell(2).font = { name: 'Arial', size: 10 };

      // Income columns
      let incTotal = 0;
      INCOME_CATS.forEach((cat, ci2) => {
        const amt = data.income[cat] || null;
        const cell = row.getCell(incomeStart + ci2);
        if (amt) { cell.value = amt; numFmt(cell); incTotal += amt; }
        totals.income[cat] = (totals.income[cat] || 0) + (amt || 0);
        styleData(cell, rowNum, wi % 2 === 0);
      });

      // Income total
      const itCell = row.getCell(incomeTotalCol);
      if (incTotal > 0) { itCell.value = incTotal; numFmt(itCell); }
      styleData(itCell, rowNum, wi % 2 === 0);
      itCell.font = { bold: true, name: 'Arial', size: 10 };

      // Expense columns
      let expTotal = 0;
      EXPENSE_CATS.forEach((cat, ei) => {
        const amt = data.expense[cat] || null;
        const cell = row.getCell(expenseStart + ei);
        if (amt) { cell.value = amt; numFmt(cell); expTotal += amt; }
        totals.expense[cat] = (totals.expense[cat] || 0) + (amt || 0);
        styleData(cell, rowNum, wi % 2 === 0);
      });

      // Expense total
      const etCell = row.getCell(expenseTotalCol);
      if (expTotal > 0) { etCell.value = expTotal; numFmt(etCell); }
      styleData(etCell, rowNum, wi % 2 === 0);
      etCell.font = { bold: true, name: 'Arial', size: 10 };
    });

    // TOTAL row for this week
    const totalRow = ws.getRow(rowNum++);
    totalRow.height = 16;
    const tcell = totalRow.getCell(2);
    tcell.value = 'TOTAL';
    tcell.font = { bold: true, name: 'Arial', size: 10 };

    let weekIncTotal = 0, weekExpTotal = 0;
    INCOME_CATS.forEach((cat, ci2) => {
      const amt = totals.income[cat] || 0;
      const cell = totalRow.getCell(incomeStart + ci2);
      cell.value = amt || 0;
      numFmt(cell);
      styleTotal(cell);
      weekIncTotal += amt;
    });
    const itc = totalRow.getCell(incomeTotalCol);
    itc.value = weekIncTotal;
    numFmt(itc); styleTotal(itc, COLOR.incomeGreen);

    EXPENSE_CATS.forEach((cat, ei) => {
      const amt = totals.expense[cat] || 0;
      const cell = totalRow.getCell(expenseStart + ei);
      cell.value = amt || 0;
      numFmt(cell);
      styleTotal(cell);
      weekExpTotal += amt;
    });
    const etc = totalRow.getCell(expenseTotalCol);
    etc.value = weekExpTotal;
    numFmt(etc); styleTotal(etc, COLOR.expenseRed);

    // Banking (income - expenses)
    const bankCell = totalRow.getCell(bankingCol);
    bankCell.value = weekIncTotal - weekExpTotal;
    numFmt(bankCell); styleTotal(bankCell);

    rowNum++; // blank separator
  });

  // Freeze header rows
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalCols } };

  return wb;
}

// ════════════════════════════════════════════════════════════════════════════
// 2. MONTHLY REPORT  (TLALEHO_MORIJA format – T-account double-entry)
// ════════════════════════════════════════════════════════════════════════════
const INCOME_ITEMS = [
  { label: '1. Chelete e Setseng (Opening Balance)', key: '__opening__', section: 'opening' },
  { label: '   Ofising', key: '__office__', section: 'opening' },
  { label: '   Bankeng', key: '__bank__', section: 'opening' },
  { label: '   Letsete', key: '__invest__', section: 'opening' },
  { label: '   Kakaretso', key: '__open_total__', section: 'opening', isTotal: true },
  { label: '2. Seboka', key: null, section: 'seboka' },
  { label: '   Pitso / Khopotso', key: 'PITSO', section: 'seboka' },
  { label: '   Mokotla I', key: 'MOKOTLA I', section: 'seboka' },
  { label: '   Mokotla II', key: 'MOKOTLA II', section: 'seboka' },
  { label: '   Kakaretso', key: '__seboka_total__', section: 'seboka', isTotal: true },
  { label: '3. Parishe', key: null, section: 'parish' },
  { label: '   Kabelo', key: 'KABELO', section: 'parish' },
  { label: '   Lilopotsiea', key: 'LILOPOTSIEA', section: 'parish' },
  { label: '   Lisontaha (Mekete)', key: 'MEKETE', section: 'parish' },
  { label: '   Boshome', key: 'BOSHOME', section: 'parish' },
  { label: '   Boitlamo (Pledge)', key: 'BOITLAMO', section: 'parish' },
  { label: '   Phallelo / Lithuso', key: 'PHALLELO', section: 'parish' },
  { label: '   Tlatsetso / Others', key: 'TLATSETSO', section: 'parish' },
  { label: '   Kakaretso', key: '__parish_total__', section: 'parish', isTotal: true },
  { label: '   KAKARETSO E KGUBEDU (TSE KENENG)', key: '__grand_income__', isGrand: true },
];

const EXPENSE_ITEMS = [
  { label: 'Meputso (Salaries)', key: null, section: 'salary' },
  { label: '   Moruti', key: 'MORUTI', section: 'salary' },
  { label: '   Baboleli', key: 'BABOLELI', section: 'salary' },
  { label: '   Morutuoa', key: 'MORUTUOA', section: 'salary' },
  { label: '   Kakaretso', key: '__salary_total__', section: 'salary', isTotal: true },
  { label: 'Pitso / Khopotso', key: 'PITSO_EXP', section: 'admin' },
  { label: 'Mokotla I', key: 'MOKOTLA_I_EXP', section: 'admin' },
  { label: 'Mokotla II', key: 'MOKOTLA_II_EXP', section: 'admin' },
  { label: 'Konsistori', key: 'KONSISTORI', section: 'admin' },
  { label: 'Ofisi', key: 'OFISI', section: 'admin' },
  { label: 'Maeto (Transport)', key: 'TRANSPORT', section: 'admin' },
  { label: 'Selallo (Food)', key: 'LIJO', section: 'admin' },
  { label: 'Lithupelo / Boikhutso', key: 'LITHUPELO', section: 'admin' },
  { label: 'Metsi / Motlakase', key: 'WASCO', section: 'admin' },
  { label: 'Fono / Poso', key: 'PHONE', section: 'admin' },
  { label: 'Tefello ea Banka', key: 'BANK_CHARGES', section: 'admin' },
  { label: 'Phallelo ea Mafu', key: 'PHALLELO_EXP', section: 'admin' },
  { label: '   KAKARETSO E KGUBEDU (TSE TSOILENG)', key: '__grand_expense__', isGrand: true },
];

// Map DB categories → monthly income/expense keys
const INC_KEY_MAP = {
  'PITSO': 'PITSO', 'KHOPOTSO': 'PITSO',
  'MOKOTLA I': 'MOKOTLA I', 'MOKOTLA II': 'MOKOTLA II',
  'KABELO': 'KABELO', 'MEKETE': 'MEKETE', 'LISONTAHA': 'MEKETE',
  'BOSHOME': 'BOSHOME', 'BOITLAMO': 'BOITLAMO',
  'PHALLELO': 'PHALLELO', 'TLATSETSO': 'TLATSETSO',
  'THUTHUHO': 'TLATSETSO',
  'MEA HO': 'TLATSETSO', 'TLHOEKISO': 'TLATSETSO',
  'BALISA': 'TLATSETSO', 'NTLAFATSO': 'TLATSETSO',
  'BOIKHUTSO': 'TLATSETSO',
};

const EXP_KEY_MAP = {
  'MORUTI': 'MORUTI', 'BABOLELI': 'BABOLELI', 'MORUTUOA': 'MORUTUOA',
  'LIJO': 'LIJO', 'TRANSPORT': 'TRANSPORT', 'MAETO': 'TRANSPORT',
  'ALLOWANCES': 'ALLOWANCES', 'PHONE': 'PHONE',
  'WASCO': 'WASCO', 'LEC': 'WASCO', 'METSI': 'WASCO',
  'MAINTENANCE': 'KONSISTORI', 'STATIONERY': 'OFISI',
  'KONSISTORI': 'KONSISTORI', 'OTHER': 'PHALLELO_EXP',
  'SEABO': 'PHALLELO_EXP', 'NTLAFATSO': 'PHALLELO_EXP',
  'BANK CHARGES': 'BANK_CHARGES',
};

async function generateMonthlyReport(transactions, month, year) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LECSA Botha-Bothe Financial System';
  const ws = wb.addWorksheet(`${MONTHS[month - 1]}`);

  const COLS = 10;
  ws.getColumn(1).width = 32;
  ws.getColumn(2).width = 16; // Opening bal
  ws.getColumn(3).width = 16; // This month
  ws.getColumn(4).width = 16; // Cumulative
  ws.getColumn(5).width = 4;  // spacer
  ws.getColumn(6).width = 32; // Expense label
  ws.getColumn(7).width = 16;
  ws.getColumn(8).width = 16;
  ws.getColumn(9).width = 16;
  ws.getColumn(10).width = 4;

  // ── Title block ────────────────────────────────────────────────────────────
  const addTitle = (text, size = 11, bold = true) => {
    ws.mergeCells(ws.lastRow.number + 1, 1, ws.lastRow.number, COLS);
    const row = ws.lastRow;
    ws.mergeCells(row.number, 1, row.number, COLS);
    const c = row.getCell(1);
    c.value = text;
    c.font = { bold, size, name: 'Arial' };
    c.alignment = { horizontal: 'center' };
    row.height = 18;
    return row;
  };

  ws.addRow([]);
  addTitle('KEREKE EA EVANGELI LESOTHO E BOROA HO AFRIKA', 12);
  addTitle('PARISHE EA BOTHA BOTHE', 11);
  addTitle('TLALEHO EA LICHELETE TSA PARISHE EA', 11);
  addTitle(`SELEMO SA ${year}  KHOELI EA ${String(month).padStart(2,'0')}  (${MONTHS[month-1]} ${year})`, 11);

  ws.addRow([]); // blank

  // ── Section header: TSE KENENG | TSE TSOILENG ────────────────────────────
  const shRow = ws.addRow([]);
  shRow.height = 18;
  ws.mergeCells(shRow.number, 1, shRow.number, 4);
  const shInc = shRow.getCell(1);
  shInc.value = 'TSE KENENG (INCOME)';
  styleHeader(shInc, 'FF006400');

  ws.mergeCells(shRow.number, 6, shRow.number, 9);
  const shExp = shRow.getCell(6);
  shExp.value = 'TSE TSOILENG (EXPENDITURE)';
  styleHeader(shExp, 'FF8B0000');

  // ── Column sub-headers ────────────────────────────────────────────────────
  const chRow = ws.addRow([]);
  chRow.height = 30;
  const prevMonthLabel = month === 1
    ? `01 Jan ${year}`
    : `01 ${MONTHS_SS[month-2]} ${year}`;
  const thisMonthLabel = `${MONTHS[month-1].substring(0,3)}-${String(year).slice(2)}`;
  const endLabel = `31 ${MONTHS_SS[month-1]} ${year}`;

  [
    ['Mehloli (Source)', `B/F  ${prevMonthLabel}`, `Pokello  ${thisMonthLabel}`, `Kakaretso ${endLabel}`],
  ].forEach(labels => {
    labels.forEach((lbl, i) => {
      const c = chRow.getCell(i + 1);
      c.value = lbl;
      styleHeader(c);
    });
  });

  [
    [`Tšebeliso (Expenditure)`, `B/F  ${prevMonthLabel}`, `Tšebeliso  ${thisMonthLabel}`, `Kakaretso ${endLabel}`],
  ].forEach(labels => {
    labels.forEach((lbl, i) => {
      const c = chRow.getCell(i + 6);
      c.value = lbl;
      styleHeader(c, COLOR.headerBg);
    });
  });

  const unitRow = ws.addRow([]);
  ['Maloti','Maloti','Maloti','','','Maloti','Maloti','Maloti'].forEach((lbl,i) => {
    const c = unitRow.getCell(i <= 3 ? i+1 : i+2);
    c.value = lbl; c.font = { italic: true, name: 'Arial', size: 9 };
    c.alignment = { horizontal: 'center' };
  });

  // ── Aggregate transactions ─────────────────────────────────────────────────
  const incTotals = {};
  const expTotals = {};

  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    const cat = (t.category || '').toUpperCase();
    if (t.type === 'income') {
      const k = INC_KEY_MAP[cat] || 'TLATSETSO';
      incTotals[k] = (incTotals[k] || 0) + amt;
    } else {
      const k = EXP_KEY_MAP[cat] || 'PHALLELO_EXP';
      expTotals[k] = (expTotals[k] || 0) + amt;
    }
  });

  // Compute section totals
  const seboka = (incTotals['PITSO']||0) + (incTotals['MOKOTLA I']||0) + (incTotals['MOKOTLA II']||0);
  const parishKeys = ['KABELO','MEKETE','BOSHOME','BOITLAMO','PHALLELO','TLATSETSO','LILOPOTSIEA'];
  const parish = parishKeys.reduce((s,k) => s + (incTotals[k]||0), 0);
  const grandIncome = seboka + parish;

  const salaryKeys = ['MORUTI','BABOLELI','MORUTUOA'];
  const salary = salaryKeys.reduce((s,k) => s + (expTotals[k]||0), 0);
  const adminKeys = ['LIJO','TRANSPORT','KONSISTORI','OFISI','WASCO','PHONE','BANK_CHARGES','PHALLELO_EXP','LITHUPELO'];
  const admin = adminKeys.reduce((s,k) => s + (expTotals[k]||0), 0);
  const grandExpense = salary + admin;

  // Build rows: pair income + expense items side by side
  const maxRows = Math.max(INCOME_ITEMS.length, EXPENSE_ITEMS.length);

  const getValue = (item, totals, sectionTotals) => {
    if (!item) return null;
    if (item.isGrand) return sectionTotals.grand;
    if (item.isTotal) {
      return sectionTotals[item.section] || 0;
    }
    if (!item.key || item.key.startsWith('__')) return null;
    return totals[item.key] || 0;
  };

  const sectionInc = {
    opening: 0, seboka, parish,
    grand: grandIncome,
    __open_total__: 0, __seboka_total__: seboka, __parish_total__: parish,
    __grand_income__: grandIncome,
  };
  const sectionExp = {
    salary, admin,
    grand: grandExpense,
    __salary_total__: salary, __grand_expense__: grandExpense,
  };

  for (let i = 0; i < maxRows; i++) {
    const iItem = INCOME_ITEMS[i];
    const eItem = EXPENSE_ITEMS[i];
    const dataRow = ws.addRow([]);
    dataRow.height = 15;

    if (iItem) {
      const labelCell = dataRow.getCell(1);
      labelCell.value = iItem.label;
      labelCell.font = {
        bold: iItem.isGrand || iItem.isTotal,
        name: 'Arial', size: 10,
        color: { argb: iItem.isGrand ? '00006400' : COLOR.titleFont }
      };

      const iVal = iItem.key && !iItem.key.startsWith('__')
        ? (incTotals[iItem.key] || 0)
        : sectionInc[iItem.key];

      if (iVal !== null && iVal !== undefined) {
        const vc = dataRow.getCell(3); // "this month" column
        vc.value = iVal;
        numFmt(vc);
        const tc = dataRow.getCell(4);
        tc.value = iVal; // cumulative (same for single month)
        numFmt(tc);
        if (iItem.isGrand || iItem.isTotal) { styleTotal(vc, '00006400'); styleTotal(tc, '00006400'); }
      }
    }

    if (eItem) {
      const labelCell = dataRow.getCell(6);
      labelCell.value = eItem.label;
      labelCell.font = {
        bold: eItem.isGrand || eItem.isTotal,
        name: 'Arial', size: 10,
        color: { argb: eItem.isGrand ? '008B0000' : COLOR.titleFont }
      };

      const eVal = eItem.key && !eItem.key.startsWith('__')
        ? (expTotals[eItem.key] || 0)
        : sectionExp[eItem.key];

      if (eVal !== null && eVal !== undefined) {
        const vc = dataRow.getCell(8);
        vc.value = eVal;
        numFmt(vc);
        const tc = dataRow.getCell(9);
        tc.value = eVal;
        numFmt(tc);
        if (eItem.isGrand || eItem.isTotal) { styleTotal(vc, '008B0000'); styleTotal(tc, '008B0000'); }
      }
    }
  }

  // ── Balance row ────────────────────────────────────────────────────────────
  ws.addRow([]);
  const balRow = ws.addRow([]);
  ws.mergeCells(balRow.number, 1, balRow.number, 4);
  balRow.getCell(1).value = `NET BALANCE: M ${(grandIncome - grandExpense).toLocaleString('en-ZA', {minimumFractionDigits:2})}`;
  balRow.getCell(1).font = { bold: true, size: 12, name: 'Arial', color: { argb: grandIncome >= grandExpense ? '00006400' : '008B0000' } };
  balRow.height = 20;

  return wb;
}

// ════════════════════════════════════════════════════════════════════════════
// 3. YEARLY / RECONCILIATION (TLALEHO_PARISHE format)
// ════════════════════════════════════════════════════════════════════════════
async function generateYearlyReport(transactions, year) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LECSA Botha-Bothe Financial System';

  // ── Sheet 1: Annual Income & Expenditure (like TLALEHO EA LICHELETE EA PARISHE) ─
  const ws1 = wb.addWorksheet('TLALEHO EA LICHELETE EA PARISHE');
  ws1.getColumn(1).width = 34;
  ws1.getColumn(2).width = 6;
  ws1.getColumn(3).width = 16;
  ws1.getColumn(4).width = 6;
  ws1.getColumn(5).width = 34;
  ws1.getColumn(6).width = 6;
  ws1.getColumn(7).width = 16;

  const add1 = (text, size=11) => {
    const r = ws1.addRow([text]);
    ws1.mergeCells(r.number, 1, r.number, 7);
    r.getCell(1).font = { bold: true, size, name:'Arial' };
    r.getCell(1).alignment = { horizontal:'center' };
    r.height = 18;
    return r;
  };
  add1('KEREKE EA EVANGELI LESOTHO E BOROA HO AFRIKA', 12);
  add1(`PARISHE EA BOTHA BOTHE LECSA`, 11);
  add1(`TLALEHO EA LICHELETE EA SELEMO SA ${year}`, 11);
  ws1.addRow([]);

  // Section headers
  const sh = ws1.addRow([]);
  sh.height = 18;
  ws1.mergeCells(sh.number, 1, sh.number, 3);
  styleHeader(ws1.getCell(sh.number, 1), 'FF006400');
  ws1.getCell(sh.number, 1).value = 'TSE KENENG (INCOME)';
  ws1.mergeCells(sh.number, 5, sh.number, 7);
  styleHeader(ws1.getCell(sh.number, 5), 'FF8B0000');
  ws1.getCell(sh.number, 5).value = 'TSE TSOILENG (EXPENDITURE)';

  const ch = ws1.addRow(['MEHLOLI', '', 'Maloti', '', 'Tšebeliso', '', 'Maloti']);
  ch.height = 16;
  [1,5].forEach(c => styleHeader(ws1.getCell(ch.number, c)));
  [3,7].forEach(c => { styleHeader(ws1.getCell(ch.number, c)); });

  // Aggregate by year
  const incY = {}, expY = {};
  transactions.filter(t => new Date(t.transaction_date || t.week_start).getFullYear() == year)
    .forEach(t => {
      const amt = parseFloat(t.amount)||0;
      const cat = (t.category||'').toUpperCase();
      if (t.type==='income') { const k=INC_KEY_MAP[cat]||'TLATSETSO'; incY[k]=(incY[k]||0)+amt; }
      else { const k=EXP_KEY_MAP[cat]||'PHALLELO_EXP'; expY[k]=(expY[k]||0)+amt; }
    });

  const yearIncItems = [
    ['1. CHELETE E SETSENG (Opening Balance)', null],
    ['    Ofising', null], ['    Bankeng', null], ['    Letsete', null],
    ['Kakaretso', '__open__'],
    ['2. SEBOKA:'],
    ['    Pitso / Khopotso', incY['PITSO']||0],
    ['    Thuthuho', incY['THUTHUHO']||0],
    ['    Mokotla I', incY['MOKOTLA I']||0],
    ['    Mokotla II', incY['MOKOTLA II']||0],
    ['Kakaretso', (incY['PITSO']||0)+(incY['MOKOTLA I']||0)+(incY['MOKOTLA II']||0)],
    ['3. PARISHE:'],
    ['    Kabelo', incY['KABELO']||0],
    ['    Lilopotsiea', incY['LILOPOTSIEA']||0],
    ['    Lisontaha / Mekete', incY['MEKETE']||0],
    ['    Boshome', incY['BOSHOME']||0],
    ['    Boitlamo', incY['BOITLAMO']||0],
    ['    Teboho / Others', incY['TLATSETSO']||0],
    ['    Phallelo / Lithuso', incY['PHALLELO']||0],
    ['    Kakaretso (Parish)', Object.values(incY).reduce((s,v)=>s+v,0)],
    ['KAKARETSO E KGUBEDU', Object.values(incY).reduce((s,v)=>s+v,0), true],
  ];

  const yearExpItems = [
    ['LITSIANE (Salaries)'],
    ['    Moruti', expY['MORUTI']||0],
    ['    Baboleli', expY['BABOLELI']||0],
    ['    Morutuoa', expY['MORUTUOA']||0],
    ['Kakaretso', (expY['MORUTI']||0)+(expY['BABOLELI']||0)+(expY['MORUTUOA']||0)],
    ['Pitso / Khopotso', expY['PITSO_EXP']||0],
    ['Thuthuho', expY['THUTHUHO_EXP']||0],
    ['Mokotla I', expY['MOKOTLA_I_EXP']||0],
    ['Mokotla II', expY['MOKOTLA_II_EXP']||0],
    ['Konsistori', expY['KONSISTORI']||0],
    ['Ofisi', expY['OFISI']||0],
    ['Maeto (Transport)', expY['TRANSPORT']||0],
    ['Selallo (Food)', expY['LIJO']||0],
    ['Lithupelo', expY['LITHUPELO']||0],
    ['Metsi / Motlakase', expY['WASCO']||0],
    ['Fono / Poso', expY['PHONE']||0],
    ['Tefello ea Banka', expY['BANK_CHARGES']||0],
    ['Phallelo', expY['PHALLELO_EXP']||0],
    ['KAKARETSO E KGUBEDU', Object.values(expY).reduce((s,v)=>s+v,0), true],
  ];

  const maxR = Math.max(yearIncItems.length, yearExpItems.length);
  for (let i=0; i<maxR; i++) {
    const row = ws1.addRow([]);
    row.height = 15;
    if (yearIncItems[i]) {
      const [lbl, val, bold] = yearIncItems[i];
      row.getCell(1).value = lbl;
      row.getCell(1).font = { bold: !!bold, name:'Arial', size:10 };
      if (val !== null && val !== undefined) {
        row.getCell(3).value = val;
        numFmt(row.getCell(3));
        if (bold) styleTotal(row.getCell(3), '00006400');
      }
    }
    if (yearExpItems[i]) {
      const [lbl, val, bold] = yearExpItems[i];
      row.getCell(5).value = lbl;
      row.getCell(5).font = { bold: !!bold, name:'Arial', size:10 };
      if (val !== null && val !== undefined) {
        row.getCell(7).value = val;
        numFmt(row.getCell(7));
        if (bold) styleTotal(row.getCell(7), '008B0000');
      }
    }
  }

  // ── Sheet 2: Reconciliation (TLALEHO_PARISHE Sheet1 format) ───────────────
  const ws2 = wb.addWorksheet('RECONCILIATION STATEMENT');
  ws2.getColumn(1).width = 30;
  for (let c=2; c<=14; c++) ws2.getColumn(c).width = 10;

  const r2add = (text, size=11) => {
    const r=ws2.addRow([text]);
    ws2.mergeCells(r.number,1,r.number,14);
    r.getCell(1).font={bold:true,size,name:'Arial'};
    r.getCell(1).alignment={horizontal:'center'};
    r.height=18; return r;
  };
  r2add('KEREKE EA EVANGELI LESOTHO E BOROA HO AFRIKA',12);
  r2add('PARISHE EA BOTHA BOTHE',11);
  r2add('INCOME AND EXPENDITURE RECONCILIATION',11);
  r2add(`AS AT 31 DECEMBER ${year}`,11);
  ws2.addRow([]);

  // Month headers
  const mhRow = ws2.addRow(['', ...MONTHS_SS, 'KAKARETSO']);
  mhRow.height = 16;
  mhRow.eachCell(c => styleHeader(c));

  // Group by month
  const byMonth = {};
  for(let m=1;m<=12;m++) byMonth[m]={income:0,expense:0};

  transactions.filter(t => new Date(t.transaction_date||t.week_start).getFullYear()==year)
    .forEach(t => {
      const m = new Date(t.transaction_date||t.week_start).getMonth()+1;
      const amt = parseFloat(t.amount)||0;
      if(t.type==='income') byMonth[m].income+=amt;
      else byMonth[m].expense+=amt;
    });

  const months = Object.keys(byMonth).map(Number).sort((a,b)=>a-b);
  const totalInc = months.reduce((s,m)=>s+byMonth[m].income,0);
  const totalExp = months.reduce((s,m)=>s+byMonth[m].expense,0);

  const addRecRow = (label, vals, color=null) => {
    const row = ws2.addRow([label, ...vals]);
    row.height = 15;
    row.getCell(1).font = { bold:true, name:'Arial', size:10 };
    for(let c=2;c<=14;c++) {
      numFmt(row.getCell(c));
      if(color) row.getCell(c).font = { bold:true, color:{argb:color}, name:'Arial', size:10 };
    }
    return row;
  };

  addRecRow('INCOME FOR THE MONTH', [...months.map(m=>byMonth[m].income), totalInc], '00006400');
  addRecRow('EXPENDITURE FOR THE MONTH', [...months.map(m=>byMonth[m].expense), totalExp], '008B0000');
  const nets = months.map(m=>byMonth[m].income - byMonth[m].expense);
  addRecRow('NET BALANCE', [...nets, nets.reduce((s,v)=>s+v,0)]);

  // ── Sheet 3: Monthly Ledger summary ─────────────────────────────────────
  const ws3 = wb.addWorksheet('LIKOLEKE (Monthly Ledger)');
  ws3.getColumn(1).width = 20;
  ws3.getColumn(2).width = 20;
  for(let c=3;c<=7;c++) ws3.getColumn(c).width=14;

  const lhRow = ws3.addRow(['Date','Church','Category','Type','Amount (LSL)','Description']);
  lhRow.height=18;
  lhRow.eachCell(c=>styleHeader(c));

  transactions.sort((a,b)=>new Date(a.week_start)-new Date(b.week_start))
    .forEach((t,i) => {
      const row = ws3.addRow([
        new Date(t.week_start),
        t.church||'',
        t.category||'',
        t.type==='income'?'INCOME':'EXPENSE',
        parseFloat(t.amount)||0,
        t.description||'',
      ]);
      row.getCell(1).numFmt = 'DD-MMM-YYYY';
      numFmt(row.getCell(5));
      if(i%2===0) row.eachCell(c=>{
        c.fill={type:'pattern',pattern:'solid',fgColor:{argb:COLOR.altRow}};
      });
      row.getCell(4).font = {
        color:{argb: t.type==='income'?'00006400':'008B0000'},
        name:'Arial', size:10
      };
    });

  ws3.autoFilter = { from:{row:1,column:1}, to:{row:1,column:6} };
  ws3.views = [{ state:'frozen', xSplit:0, ySplit:1 }];

  return wb;
}

// ════════════════════════════════════════════════════════════════════════════
// 4. QUARTERLY REPORT
// ════════════════════════════════════════════════════════════════════════════
async function generateQuarterlyReport(transactions, quarter, year) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LECSA Botha-Bothe Financial System';

  const qMonths = {1:[1,2,3], 2:[4,5,6], 3:[7,8,9], 4:[10,11,12]};
  const monthNums = qMonths[quarter];
  const ws = wb.addWorksheet(`Q${quarter} ${year}`);

  ws.getColumn(1).width = 30;
  for(let c=2;c<=10;c++) ws.getColumn(c).width=14;

  // Title
  const addT = (text, size=11) => {
    const r=ws.addRow([text]);
    ws.mergeCells(r.number,1,r.number,10);
    r.getCell(1).font={bold:true,size,name:'Arial'};
    r.getCell(1).alignment={horizontal:'center'};
    r.height=18; return r;
  };
  addT('KEREKE EA EVANGELI LESOTHO E BOROA HO AFRIKA',12);
  addT('PARISHE EA BOTHA BOTHE',11);
  addT(`TLALEHO EA LICHELETE - KOTARA EA ${quarter} (Q${quarter} ${year})`,11);
  ws.addRow([]);

  // Per-month columns
  const mLabels = monthNums.map(m=>MONTHS[m-1]);
  const hRow = ws.addRow(['Mehloli (Source)', ...mLabels, 'Q TOTAL']);
  hRow.height=20;
  hRow.eachCell(c=>styleHeader(c));

  // Aggregate
  const byMonth={};
  monthNums.forEach(m=>{byMonth[m]={income:{},expense:{}};});

  transactions.filter(t=>{
    const m=new Date(t.transaction_date||t.week_start).getMonth()+1;
    return monthNums.includes(m) && new Date(t.transaction_date||t.week_start).getFullYear()==year;
  }).forEach(t=>{
    const m=new Date(t.transaction_date||t.week_start).getMonth()+1;
    const amt=parseFloat(t.amount)||0;
    const cat=(t.category||'').toUpperCase();
    if(t.type==='income'){const k=INC_KEY_MAP[cat]||'TLATSETSO'; byMonth[m].income[k]=(byMonth[m].income[k]||0)+amt;}
    else{const k=EXP_KEY_MAP[cat]||'PHALLELO_EXP'; byMonth[m].expense[k]=(byMonth[m].expense[k]||0)+amt;}
  });

  const incKeys = ['PITSO','MOKOTLA I','MOKOTLA II','KABELO','MEKETE','BOSHOME','BOITLAMO','TLATSETSO'];
  const expKeys = ['MORUTI','BABOLELI','MORUTUOA','LIJO','TRANSPORT','KONSISTORI','OFISI','WASCO','PHONE'];

  const addCatRow = (label, getVal, bold=false) => {
    const vals = monthNums.map(m=>getVal(byMonth[m])||0);
    const total = vals.reduce((s,v)=>s+v,0);
    const row = ws.addRow([label,...vals,total]);
    row.height=15;
    row.getCell(1).font={bold,name:'Arial',size:10};
    for(let c=2;c<=vals.length+2;c++){numFmt(row.getCell(c)); if(bold) styleTotal(row.getCell(c));}
    return row;
  };

  // Income section
  const incHead = ws.addRow(['TSE KENENG (INCOME)']);
  ws.mergeCells(incHead.number,1,incHead.number,10);
  styleHeader(ws.getCell(incHead.number,1),'FF006400');
  incHead.height=16;

  incKeys.forEach(k => {
    addCatRow(`    ${k.charAt(0)+k.slice(1).toLowerCase()}`, m=>m.income[k]);
  });
  addCatRow('KAKARETSO - TSE KENENG', m=>Object.values(m.income).reduce((s,v)=>s+v,0), true);

  ws.addRow([]);

  // Expense section
  const expHead = ws.addRow(['TSE TSOILENG (EXPENDITURE)']);
  ws.mergeCells(expHead.number,1,expHead.number,10);
  styleHeader(ws.getCell(expHead.number,1),'FF8B0000');
  expHead.height=16;

  expKeys.forEach(k => {
    addCatRow(`    ${k.charAt(0)+k.slice(1).toLowerCase()}`, m=>m.expense[k]);
  });
  addCatRow('KAKARETSO - TSE TSOILENG', m=>Object.values(m.expense).reduce((s,v)=>s+v,0), true);

  ws.addRow([]);
  addCatRow('NET BALANCE (TSE KENENG - TSE TSOILENG)',
    m=>Object.values(m.income).reduce((s,v)=>s+v,0)-Object.values(m.expense).reduce((s,v)=>s+v,0),
    true);

  ws.views=[{state:'frozen',xSplit:1,ySplit:5}];
  return wb;
}

// ════════════════════════════════════════════════════════════════════════════
// Express route handlers
// ════════════════════════════════════════════════════════════════════════════
async function sendWorkbook(wb, res, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

async function handleDownload(req, res, pool) {
  const { period, year, month, quarter, week_start } = req.query;

  try {
    let query = 'SELECT * FROM financial_transactions ORDER BY transaction_date DESC, id DESC';
    let params = [];

    // Filter by year if provided
    if (year) {
      query = `SELECT * FROM financial_transactions WHERE EXTRACT(YEAR FROM transaction_date) = $1 ORDER BY transaction_date, id`;
      params = [year];
    }
    if (week_start) {
      query = `SELECT * FROM financial_transactions WHERE week_start = $1 ORDER BY transaction_date, id`;
      params = [week_start];
    }

    const result = await pool.query(query, params);
    const transactions = result.rows;

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const q = parseInt(quarter) || Math.ceil(m / 3);

    let wb, filename;

    switch (period) {
      case 'weekly': {
        const wk = week_start || new Date().toISOString().split('T')[0];
        wb = await generateWeeklyReport(transactions, wk);
        const d = new Date(wk);
        filename = `LECSA_LIKOLEKE_${d.toISOString().split('T')[0]}.xlsx`;
        break;
      }
      case 'monthly':
        wb = await generateMonthlyReport(transactions, m, y);
        filename = `LECSA_TLALEHO_KHOELI_${MONTHS[m-1]}_${y}.xlsx`;
        break;
      case 'quarterly':
        wb = await generateQuarterlyReport(transactions, q, y);
        filename = `LECSA_TLALEHO_KOTARA_Q${q}_${y}.xlsx`;
        break;
      case 'yearly':
      default:
        wb = await generateYearlyReport(transactions, y);
        filename = `LECSA_TLALEHO_SELEMO_${y}.xlsx`;
        break;
    }

    await sendWorkbook(wb, res, filename);

  } catch (err) {
    console.error('Excel generation error:', err);
    res.status(500).json({ error: 'Failed to generate Excel file', message: err.message });
  }
}

module.exports = { handleDownload, generateWeeklyReport, generateMonthlyReport, generateQuarterlyReport, generateYearlyReport };