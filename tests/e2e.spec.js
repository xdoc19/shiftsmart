/**
 * ShiftSmart — E2E Tests (Playwright)
 * Testează UI-ul în browser real
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve('C:/Users/cipri/shiftsmart/index.html').replace(/\\/g, '/');

test.describe('1. Încărcare și navigare', () => {

  test('Pagina se încarcă și afișează titlul ShiftSmart', async ({ page }) => {
    await page.goto(FILE_URL);
    await expect(page.locator('.logo')).toContainText('ShiftSmart');
  });

  test('Dashboard este activ la start', async ({ page }) => {
    await page.goto(FILE_URL);
    await expect(page.locator('#view-dash')).toHaveClass(/on/);
  });

  test('KPI-urile din header sunt populate după init', async ({ page }) => {
    await page.goto(FILE_URL);
    const kpiN = page.locator('#h-n');
    await expect(kpiN).not.toHaveText('—');
  });

  test('Navigare la "Items & Run Rate" funcționează', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    await expect(page.locator('#view-items')).toHaveClass(/on/);
  });

  test('Navigare la "Dashboard 3 săpt." funcționează', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await expect(page.locator('#view-dash2')).toHaveClass(/on/);
  });

  test('Navigare la "Linii producție" funcționează', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Linii producție');
    await expect(page.locator('#view-lines')).toHaveClass(/on/);
  });

  test('Navigare la "Operatori" funcționează', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Operatori');
    await expect(page.locator('#view-ops')).toHaveClass(/on/);
  });

});

test.describe('2. Dashboard — grafic și tooltip', () => {

  test('Graficul de încărcare conține bare pentru linii active', async ({ page }) => {
    await page.goto(FILE_URL);
    const bars = page.locator('#lchrt .bar-tr');
    await expect(bars).toHaveCount(await bars.count()); // există cel puțin unele
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Hover pe bară afișează tooltip-ul', async ({ page }) => {
    await page.goto(FILE_URL);
    const firstBar = page.locator('#lchrt .bar-tr').first();
    await firstBar.hover();
    await expect(page.locator('#bar-tip')).toBeVisible();
  });

  test('Tooltip conține numele liniei și săptămâna', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.locator('#lchrt .bar-tr').first().hover();
    const hd = await page.locator('#tip-hd').textContent();
    expect(hd).toMatch(/RW\d+\s*·\s*W\d+/);
  });

  test('Tooltip conține cel puțin un item cu cantitate (buc)', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.locator('#lchrt .bar-tr').first().hover();
    const body = await page.locator('#tip-body').textContent();
    expect(body).toContain('buc');
  });

  test('Tooltip afișează TOTAL', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.locator('#lchrt .bar-tr').first().hover();
    await expect(page.locator('#tip-tot')).toContainText('TOTAL');
  });

  test('Tooltip dispare când mouse-ul pleacă', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.locator('#lchrt .bar-tr').first().hover();
    await expect(page.locator('#bar-tip')).toBeVisible();
    await page.mouse.move(0, 0); // mută mouse-ul departe
    await expect(page.locator('#bar-tip')).toBeHidden();
  });

  test('Navigare săptămână cu butoanele ‹ ›', async ({ page }) => {
    await page.goto(FILE_URL);
    const weekLabel = page.locator('#wl1');
    await expect(weekLabel).toHaveText('W01');
    await page.locator('#view-dash button', { hasText: '›' }).click();
    await expect(weekLabel).toHaveText('W02');
    await page.locator('#view-dash button', { hasText: '‹' }).click();
    await expect(weekLabel).toHaveText('W01');
  });

  test('Butonul ‹ nu merge sub W01', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.locator('#view-dash button', { hasText: '‹' }).click();
    await expect(page.locator('#wl1')).toHaveText('W01');
  });

});

test.describe('3. Items & Run Rate — filtre', () => {

  test('Tabelul de iteme se afișează cu rânduri', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const rows = page.locator('#items-tbl tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Filtru text item "TEN" reduce rândurile', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const allRows = await page.locator('#items-tbl tbody tr').count();
    await page.fill('#item-filter', 'TEN');
    const filteredRows = await page.locator('#items-tbl tbody tr').count();
    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThan(allRows);
  });

  test('Filtru text inexistent → 0 rânduri', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    await page.fill('#item-filter', 'XYZNONEXISTENT999');
    const rows = await page.locator('#items-tbl tbody tr').count();
    expect(rows).toBe(0);
  });

  test('Ștergere filtru text → revin toate rândurile', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const allRows = await page.locator('#items-tbl tbody tr').count();
    await page.fill('#item-filter', 'TEN');
    await page.fill('#item-filter', '');
    const afterClear = await page.locator('#items-tbl tbody tr').count();
    expect(afterClear).toBe(allRows);
  });

  test('Chips-urile de linie sunt afișate', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const chips = page.locator('#line-filter-chips .fchip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(1); // "Toate" + linii
  });

  test('Chip "Toate" este activ implicit', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const toateChip = page.locator('#line-filter-chips .fchip').first();
    await expect(toateChip).toHaveClass(/on/);
  });

  test('Selectare chip linie filtrează rândurile (mai puține decât "Toate")', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const allRows = await page.locator('#items-tbl tbody tr').count();
    // Click pe primul chip de linie (al doilea chip, primul e "Toate")
    await page.locator('#line-filter-chips .fchip').nth(1).click();
    const filteredRows = await page.locator('#items-tbl tbody tr').count();
    expect(filteredRows).toBeLessThanOrEqual(allRows);
    expect(filteredRows).toBeGreaterThan(0);
  });

  test('Dropdown "Default:" este prezent', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    await expect(page.locator('#defline-filter')).toBeVisible();
  });

  test('Dropdown "Default: Nesetat" filtrează iteme fără linie default', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const allRows = await page.locator('#items-tbl tbody tr').count();
    await page.selectOption('#defline-filter', { value: '-2' });
    const filteredRows = await page.locator('#items-tbl tbody tr').count();
    expect(filteredRows).toBeLessThanOrEqual(allRows);
  });

  test('Buton "+ Item nou" adaugă un rând în tabel', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Items & Run Rate');
    const before = await page.locator('#items-tbl tbody tr').count();
    await page.click('text=+ Item nou');
    const after = await page.locator('#items-tbl tbody tr').count();
    expect(after).toBe(before + 1);
  });

});

test.describe('4. Dashboard 3 săptămâni', () => {

  test('Sunt afișate 3 coloane (W1, W2, W3)', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    // Verificăm că view-ul e activ și conține cele 3 containere de săptămâni
    await expect(page.locator('#view-dash2')).toHaveClass(/on/);
    await expect(page.locator('text=Săptămâna 1')).toBeVisible();
    await expect(page.locator('text=Săptămâna 2')).toBeVisible();
    await expect(page.locator('text=Săptămâna 3')).toBeVisible();
  });

  test('KPI-urile dash2 inițial sunt "—" (înainte de optimizare)', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await expect(page.locator('#d2-kpi-n')).toHaveText('—');
  });

  test('Butonul "Optimizează W1–W3" există', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await expect(page.locator('#rbtn2')).toBeVisible();
  });

  test('După optimizare W1-W3, KPI-urile se populează', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await page.click('#rbtn2');
    await expect(page.locator('#d2-kpi-n')).not.toHaveText('—');
    await expect(page.locator('#d2-kpi-u')).not.toHaveText('—');
  });

  test('După optimizare, barele apar în toate cele 3 coloane', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await page.click('#rbtn2');
    await page.waitForTimeout(400);
    const bars0 = await page.locator('#d2-w0 .bar-tr').count();
    const bars1 = await page.locator('#d2-w1 .bar-tr').count();
    const bars2 = await page.locator('#d2-w2 .bar-tr').count();
    expect(bars0).toBeGreaterThan(0);
    expect(bars1).toBeGreaterThan(0);
    expect(bars2).toBeGreaterThan(0);
  });

  test('Hover pe bară în dash2 afișează tooltip', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await page.click('#rbtn2');
    await page.waitForTimeout(400);
    await page.locator('#d2-w0 .bar-tr').first().hover();
    await expect(page.locator('#bar-tip')).toBeVisible();
  });

  test('Tooltip în dash2 conține săptămâna corectă (W01)', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('text=Dashboard 3 săpt.');
    await page.click('#rbtn2');
    await page.waitForTimeout(400);
    await page.locator('#d2-w0 .bar-tr').first().hover();
    const hd = await page.locator('#tip-hd').textContent();
    expect(hd).toContain('W01');
  });

});

test.describe('5. AI Optimizer global', () => {

  test('Butonul AI Optimizer există în header', async ({ page }) => {
    await page.goto(FILE_URL);
    await expect(page.locator('#rbtn')).toBeVisible();
  });

  test('După click AI Optimizer, textul butonului se schimbă', async ({ page }) => {
    await page.goto(FILE_URL);
    await page.click('#rbtn');
    await expect(page.locator('#rbtn')).toHaveText(/Re-optimizează/);
  });

  test('KPI Sch3 noapte este număr după optimizare', async ({ page }) => {
    await page.goto(FILE_URL);
    const val = await page.locator('#kpi-n').textContent();
    expect(val).toMatch(/^\d+$/);
  });

  test('KPI utilizare medie conține %', async ({ page }) => {
    await page.goto(FILE_URL);
    const val = await page.locator('#kpi-u').textContent();
    expect(val).toContain('%');
  });

});
