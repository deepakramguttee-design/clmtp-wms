import { chromium } from 'playwright';
const br = await chromium.launch({ headless: true });
const page = await br.newPage();
await page.setViewportSize({ width: 1500, height: 900 });

// Login
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

// Screenshot avant changement
const clip = await page.evaluate(() => {
  const t = document.querySelector('table');
  const r = t.getBoundingClientRect();
  return { x: Math.max(0,r.x-10), y: Math.max(0,r.y-5), width: Math.min(r.width+20,1480), height: 220 };
});
await page.screenshot({ path: 'C:/tmp/sel_avant.png', clip });
console.log('Avant: screenshot pris');

// Sélectionner "Engins GC et MP" dans le 1er select de la colonne Catégorie
const selects = await page.$$('table select');
console.log('Nb selects trouvés:', selects.length);
if (selects.length > 0) {
  // Lire la valeur avant
  const before = await selects[0].inputValue();
  console.log('Valeur avant:', before || '(vide = Non classé)');

  // Choisir "Pelle" (index 2 dans la liste)
  await selects[0].selectOption({ index: 2 });
  await page.waitForTimeout(1500); // laisse le temps au PATCH Supabase
  const after = await selects[0].inputValue();
  console.log('Valeur après:', after);

  await page.screenshot({ path: 'C:/tmp/sel_apres.png', clip });
  console.log('Après: screenshot pris');
}
await br.close();
