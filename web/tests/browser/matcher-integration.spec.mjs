import { test, expect } from '@playwright/test';
import { workspace, origin } from './workspace-fixture.mjs';
for (const width of [1440, 390]) test(`real shared matcher reaches the web profile at ${width}px`, async ({page})=>{
  await page.setViewportSize({width,height:1000});
  const env=await workspace(page);
  try {
    await page.goto(origin+'/#/home?tab=people');
    await page.getByRole('button',{name:"View Maya Chen's profile"}).click();
    const dialog=page.getByRole('dialog',{name:'Maya Chen — full profile'});
    await expect(dialog.locator('.np-score-value')).toHaveText('100/100');
    await expect(dialog.locator('.np-score')).toHaveClass(/np-score--high/);
    await expect(dialog.locator('.np-compatibility-summary')).toContainText('Build Together');
    await expect(dialog.getByText('AI networking assessment',{exact:true})).toHaveCount(0);
    await dialog.locator('summary').filter({hasText:'Shared-experience match'}).click();
    await expect(dialog.locator('.np-breakdown')).toContainText('Networking fitNot assessed');
    await expect(dialog.locator('.np-breakdown')).toContainText('Professional experience100 / 100');
    await dialog.locator('summary').filter({hasText:'More about Maya'}).click();
    await expect(dialog.locator('.np-more-profile-body')).toContainText('Build Together · hackathon · 2025');
    await dialog.locator('.np-compatibility').scrollIntoViewIfNeeded();
    await page.screenshot({path:`.impeccable/review/matcher-integration-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading',{name:'The Builders Room',exact:true})).toBeVisible();
  } finally {await env.close();}
});
