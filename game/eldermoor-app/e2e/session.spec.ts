import { expect, test, type Page } from '@playwright/test';

/**
 * Two journeys through the shipped client. Not unit slices.
 * 1. Title → walk onto wood → bind the tutorial pouch → place a bed → heat moves.
 * 2. Save survives reload. A corrupt blob does not brick the boot.
 */

interface Probe {
  running: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  wood: number;
  stone: number;
  heat: number;
  ownedNames: string[];
  focusName: string | null;
  capture: string;
  stations: number;
  resources: { kind: string; x: number; z: number; remaining: number }[];
  beasts: { speciesId: string; name: string; x: number; z: number; hp: number }[];
}

const MOVE_KEYS = [
  'w',
  'a',
  's',
  'd',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'f',
] as const;

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const hook = window.__eldermoor;
    if (hook == null) throw new Error('missing ?e2e=1 probe');
    return hook.probe();
  });
}

async function releaseKeys(page: Page): Promise<void> {
  for (const key of MOVE_KEYS) await page.keyboard.up(key);
}

function wrapAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Face a world point and walk there with WASD + arrows. Stops inside `stopDist` meters. */
async function walkTo(page: Page, x: number, z: number, stopDist: number): Promise<Probe> {
  const deadline = Date.now() + 12_000;
  let last = await probe(page);
  while (Date.now() < deadline) {
    last = await probe(page);
    const dx = x - last.x;
    const dz = z - last.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= stopDist) {
      await page.keyboard.up('w');
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      return last;
    }
    const desired = Math.atan2(-dx, -dz);
    const err = wrapAngle(desired - last.yaw);
    if (err > 0.18) {
      await page.keyboard.up('w');
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('ArrowLeft');
    } else if (err < -0.18) {
      await page.keyboard.up('w');
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.down('ArrowRight');
    } else {
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('w');
    }
    await page.waitForTimeout(40);
  }
  throw new Error(
    `did not reach (${x.toFixed(1)}, ${z.toFixed(1)}); stuck at (${last.x.toFixed(1)}, ${last.z.toFixed(1)})`,
  );
}

/** Track the live pouch: turn, close to a few meters, then hold that gap. */
async function lineUpPouch(page: Page): Promise<void> {
  await releaseKeys(page);
  const deadline = Date.now() + 15_000;
  let last = await probe(page);
  while (Date.now() < deadline) {
    last = await probe(page);
    const pouch = last.beasts.find((b) => b.speciesId === 'B01' && b.hp > 0);
    if (pouch == null) throw new Error('tutorial pouch is gone');
    const dx = pouch.x - last.x;
    const dz = pouch.z - last.z;
    const dist = Math.hypot(dx, dz);
    const err = wrapAngle(Math.atan2(-dx, -dz) - last.yaw);
    const pitchErr = 0.82 - last.pitch;
    if (Math.abs(err) > 0.28) {
      await page.keyboard.up('w');
      await page.keyboard.up('s');
      if (err > 0) {
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowLeft');
      } else {
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.down('ArrowRight');
      }
    } else {
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('ArrowRight');
    }
    if (pitchErr > 0.06) {
      await page.keyboard.up('ArrowUp');
      await page.keyboard.down('ArrowDown');
    } else if (pitchErr < -0.06) {
      await page.keyboard.up('ArrowDown');
      await page.keyboard.down('ArrowUp');
    } else {
      await page.keyboard.up('ArrowUp');
      await page.keyboard.up('ArrowDown');
    }
    if (Math.abs(err) <= 0.28) {
      if (dist > 7) {
        await page.keyboard.up('s');
        await page.keyboard.down('w');
      } else if (dist < 4) {
        await page.keyboard.up('w');
        await page.keyboard.down('s');
      } else if (Math.abs(pitchErr) <= 0.06) {
        await page.keyboard.up('w');
        await page.keyboard.up('s');
        return;
      }
    }
    await page.waitForTimeout(40);
  }
  throw new Error(
    `could not line up the pouch at player (${last.x.toFixed(1)}, ${last.z.toFixed(1)}) yaw ${last.yaw.toFixed(2)}`,
  );
}

async function enterWorld(page: Page): Promise<void> {
  await page.goto('/?e2e=1');
  await page.getByRole('button', { name: 'Wild Arcana betreten' }).click();
  await expect(page.locator('#objective-text')).toContainText(/Holz|HOLZ/i);
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  const running = await probe(page);
  expect(running.running).toBe(true);
  expect(running.wood).toBeGreaterThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.afterEach(async ({ page }) => {
  await releaseKeys(page);
});

test('opening session: gather wood, bind the pouch, place a bed, heat ticks', async ({ page }) => {
  await enterWorld(page);
  const startWood = (await probe(page)).wood;

  const woodPile = (await probe(page)).resources.find((n) => n.kind === 'wood' && n.remaining > 0);
  expect(woodPile, 'seeded wood pile near the stones').toBeTruthy();
  if (woodPile == null) return;
  await walkTo(page, woodPile.x, woodPile.z, 1.2);

  await expect
    .poll(async () => (await probe(page)).wood, { timeout: 3_000 })
    .toBeGreaterThan(startWood);
  await expect(page.locator('#inv')).toContainText('Holz');
  const shown = await page
    .locator('#inv .inv-row', { hasText: 'Holz' })
    .locator('b')
    .first()
    .innerText();
  expect(Number(shown)).toBeGreaterThanOrEqual(4);

  let bound = false;
  let last = await probe(page);
  for (let attempt = 0; attempt < 4 && !bound; attempt++) {
    await lineUpPouch(page);
    await page.keyboard.up('f');
    await page.keyboard.down('f');
    const until = Date.now() + 3_500;
    while (Date.now() < until) {
      last = await probe(page);
      if (last.ownedNames.length > 0) {
        bound = true;
        break;
      }
      const pouch = last.beasts.find((b) => b.speciesId === 'B01' && b.hp > 0);
      if (pouch == null) break;
      const err = wrapAngle(Math.atan2(-(pouch.x - last.x), -(pouch.z - last.z)) - last.yaw);
      const dist = Math.hypot(pouch.x - last.x, pouch.z - last.z);
      if (err > 0.25) await page.keyboard.down('ArrowLeft');
      else await page.keyboard.up('ArrowLeft');
      if (err < -0.25) await page.keyboard.down('ArrowRight');
      else await page.keyboard.up('ArrowRight');
      // A held F only counts as a tap on the frame it goes down. Retap while still idle.
      if (last.capture === 'idle' && last.focusName != null && Math.abs(err) < 0.4 && dist < 10) {
        await page.keyboard.up('f');
        await page.waitForTimeout(50);
        await page.keyboard.down('f');
      }
      await page.waitForTimeout(70);
    }
    await releaseKeys(page);
  }

  const afterBind = await probe(page);
  expect(
    afterBind.ownedNames.join(' '),
    `roster empty; focus=${afterBind.focusName ?? 'none'} capture=${afterBind.capture}`,
  ).toMatch(/Glimmerpouch/i);
  await expect(page.locator('#party')).toContainText(/Glimmerpouch/i);
  expect(afterBind.heat).toBeGreaterThan(0);
  await expect(page.locator('#heat-num')).not.toHaveText('0');

  const woodBeforeBed = afterBind.wood;
  expect(woodBeforeBed).toBeGreaterThanOrEqual(4);
  await page.keyboard.press('b');
  await page.keyboard.press('e');
  await expect.poll(async () => (await probe(page)).stations, { timeout: 3_000 }).toBe(1);
  const afterBed = await probe(page);
  expect(afterBed.wood).toBeLessThan(woodBeforeBed);
  await expect(page.locator('#toast')).toContainText(/gebaut|Bett/i);
});

test('save reloads, and a corrupt blob still boots a new session', async ({ page }) => {
  await enterWorld(page);
  const pile = (await probe(page)).resources.find((n) => n.kind === 'wood' && n.remaining > 0);
  expect(pile).toBeTruthy();
  if (pile == null) return;
  await walkTo(page, pile.x, pile.z, 1.2);
  await expect.poll(async () => (await probe(page)).wood, { timeout: 3_000 }).toBeGreaterThan(2);
  const savedWood = (await probe(page)).wood;

  const savedAt = await probe(page);
  await releaseKeys(page);
  await page.keyboard.press('t');
  await expect(page.locator('#toast')).toContainText(/gesichert/i);

  await page.reload();
  await page.getByRole('button', { name: 'Fortsetzen' }).click();
  await expect(page.locator('#objective-text')).toContainText(/Holz|Glimmer|Meilenstein|Sammle/i);
  await expect
    .poll(async () => {
      const back = await probe(page);
      return Math.hypot(back.x - savedAt.x, back.z - savedAt.z);
    })
    .toBeLessThan(3);
  // Piles are not in the save. Standing on one when the world rebuilds picks it up again.
  const loaded = await probe(page);
  expect(loaded.wood).toBeGreaterThanOrEqual(savedWood);
  const shown = await page
    .locator('#inv .inv-row', { hasText: 'Holz' })
    .locator('b')
    .first()
    .innerText();
  expect(Number(shown)).toBe(Math.floor(loaded.wood));

  await page.evaluate(() => {
    localStorage.setItem('eldermoor_save_v1', '{');
  });
  await page.reload();
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.getByRole('button', { name: 'Fortsetzen' }).click();
  await expect(page.locator('#objective-text')).toContainText(/Holz|HOLZ/i);
  await expect(page.locator('canvas[data-engine]')).toBeVisible();
  expect((await probe(page)).wood).toBe(2);
  expect(errors, errors.join('\n')).toEqual([]);
});
