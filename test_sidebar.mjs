import { chromium } from 'playwright';
const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:5175');
await page.click('button:has-text("Accéder à")');
await page.waitForTimeout(300);
await page.fill('input[type="email"]', 'deepak.ramguttee@gmail.com');
await page.fill('input[type="password"]', 'KriLee2227*-');
await page.click('button:has-text("Se connecter")');
await page.waitForTimeout(2500);
await page.click('text=Parc & Engins');
await page.waitForTimeout(300);
await page.click('text=Parc véhicules & engins');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'C:/tmp/sidebar_parc.png' });
console.log('Screenshot sidebar pris');

// Cliquer sur PRR dans la sidebar
await page.click('button:has-text("PRR et Équipements PRR")');
await page.waitForTimeout(600);
await page.screenshot({ path: 'C:/tmp/sidebar_prr.png' });
console.log('PRR actif');
await br.close();
