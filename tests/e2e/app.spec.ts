import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

test('seeded desk, search, filters and desktop accessibility', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Braun filtre kahve makinesi',exact:true})).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('searchbox').fill('RADYO');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Sony taşınabilir radyo',exact:true}).first()).toBeVisible();
  await page.getByRole('searchbox').fill('bulunmayan eşya');
  await expect(page.getByRole('heading',{name:'Aradığınız kayıt bulunamadı.'})).toBeVisible();
  await page.getByRole('button',{name:'Aramayı temizle'}).click();
  await page.getByRole('navigation').getByRole('button',{name:/Teslim edildi/}).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('navigation').getByRole('button',{name:/Açık işler/}).click();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await mkdir('docs',{recursive:true});
  await page.screenshot({path:'docs/tamir-desktop.png',fullPage:true});
});

test('intake, optimistic conflict recovery, complete workflow and persistence', async ({page,request}) => {
  await page.goto('/'); await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button',{name:'Yeni kabul',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await page.getByLabel('Müşteri adı').fill('Lale Portfolyo');
  await page.getByLabel('Eşya / marka / model').fill('Test elektrikli değirmen');
  await page.getByLabel('Bildirilen sorun').fill('Motor dönüyor ama öğütücü mekanizma hareket etmiyor.');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Kabul kaydını oluştur'}).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('kabul edildi');
  await page.getByRole('button',{name:'Test elektrikli değirmen',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Test elektrikli değirmen'})).toBeVisible();
  const result = await request.get('/api/repairs');
  const record = (await result.json()).repairs.find((row:{item:string})=>row.item==='Test elektrikli değirmen');
  expect((await request.patch(`/api/repairs/${record.id}`,{data:{version:1,status:'working',note:'Diğer sekmeden kontrol başladı.'}})).status()).toBe(200);
  await page.getByLabel('İşlem notu',{exact:true}).fill('Bu sekmede işleme alındı.');
  await page.getByRole('button',{name:'İşlemi kaydet'}).click();
  await expect(dialog.getByRole('alert')).toContainText('başka bir işlemle değişti');
  await page.getByRole('button',{name:'Güncel kaydı yükle'}).click();
  await expect(dialog.locator('.history')).toContainText('Diğer sekmeden kontrol başladı.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  for (const [status,note] of [['parts','Öğütücü dişlisi sipariş edildi.'],['working','Dişli geldi, montaj başladı.'],['ready','Dişli değişti, çalışma testi tamamlandı.'],['collected','Müşteriye çalışır olarak teslim edildi.']]) {
    await page.getByLabel('Yeni durum').selectOption(status);
    await page.getByLabel('İşlem notu',{exact:true}).fill(note);
    await page.getByRole('button',{name:'İşlemi kaydet'}).click();
    await expect(dialog.locator('.history')).toContainText(note);
  }
  await expect(dialog).toContainText('Bu iş teslim edildi.');
  await page.getByRole('button',{name:'Pencereyi kapat'}).click();
  await page.reload();
  await page.getByRole('navigation').getByRole('button',{name:/Teslim edildi/}).click();
  await page.getByRole('button',{name:'Test elektrikli değirmen',exact:true}).click();
  await expect(dialog.locator('.history li')).toHaveCount(6);
});

test('mobile layout, focus loop, escape and detail accessibility', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/'); await expect(page.locator('tbody tr')).toHaveCount(5);
  await mkdir('docs',{recursive:true});
  await page.screenshot({path:'docs/tamir-mobile.png',fullPage:true});
  const overflow = await page.evaluate(()=>({width:document.documentElement.scrollWidth, viewport:innerWidth, elements:Array.from(document.querySelectorAll('*')).filter(el=>el.getBoundingClientRect().right>innerWidth+1 && !el.closest('nav,table')).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width}))}));
  expect(overflow.width,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:'docs/tamir-mobile.png',fullPage:true});
  const trigger = page.getByRole('button',{name:'Yeni kabul',exact:true});
  await trigger.click();
  const close = page.getByRole('button',{name:'Pencereyi kapat'});
  await close.focus(); await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button',{name:'Kabul kaydını oluştur'})).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'Braun filtre kahve makinesi',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'İşlem geçmişi'})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:'docs/tamir-detail-mobile.png',fullPage:false});
});

test('loading, initial network failure, retry and last known records', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/repairs', async route => {await gate; await route.abort();});
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('İş defteri yükleniyor');
  release(); await expect(page.getByRole('alert')).toContainText('bağlanılamadı');
  await page.unroute('**/api/repairs'); await page.getByRole('button',{name:'Tekrar dene'}).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.route('**/api/repairs', route => route.abort());
  await page.getByRole('button',{name:'Kayıtları yenile'}).click();
  await expect(page.getByRole('alert')).toContainText('Son yüklenen kayıtlar gösteriliyor.');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.unroute('**/api/repairs'); await page.getByRole('button',{name:'Tekrar dene'}).click(); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('failed writes preserve form values, retry does not duplicate intake', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Yeni kabul',exact:true}).click();
  await page.getByLabel('Müşteri adı').fill('Umut Deneme'); await page.getByLabel('Eşya / marka / model').fill('Test okuma lambası'); await page.getByLabel('Bildirilen sorun').fill('Anahtar açıldığında ışık yanmıyor.');
  await page.route('**/api/repairs', async route => {
    if (route.request().method() === 'POST') {await route.fetch(); await route.abort();} else await route.continue();
  });
  await page.getByRole('button',{name:'Kabul kaydını oluştur'}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('bağlanılamadı');
  await expect(page.getByLabel('Müşteri adı')).toHaveValue('Umut Deneme');
  await page.unroute('**/api/repairs'); await page.getByRole('button',{name:'Kabul kaydını oluştur'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox').fill('Test okuma lambası'); await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('production assets and HTTP error contracts', async ({request}) => {
  const home = await request.get('/'); expect(home.status()).toBe(200); expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect((await request.get('/api/unknown')).status()).toBe(404);
  expect((await request.post('/api/repairs',{headers:{origin:'https://other.example'},data:{}})).status()).toBe(403);
  expect((await request.post('/api/repairs',{data:{}})).status()).toBe(422);
  expect((await request.post('/api/repairs',{headers:{'content-type':'text/plain'},data:'hello'})).status()).toBe(415);
});
