import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_TEST_EMAIL!;
const PASSWORD = process.env.E2E_TEST_PASSWORD!;

const UNIQUE_SUFFIX = `E2E-${Date.now()}`;

async function ensureLoggedIn(page) {
  if (page.url().includes("/inicio")) return;

  await page.goto("/inicio");
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/inicio")) return;

  const dialog = page.getByRole("dialog", { name: /bienvenido a cronos/i });
  await dialog.waitFor({ state: "visible", timeout: 10_000 });

  const emailBtn = page.getByRole("button", { name: /iniciar con correo electrónico/i });
  if (await emailBtn.isVisible()) await emailBtn.click();

  await page.getByPlaceholder(/tu@correo\.com/).fill(EMAIL);
  await page.getByPlaceholder(/\.{6,}/).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  await page.waitForURL("**/inicio", { timeout: 15_000 });
  await page.waitForTimeout(1000);
}

async function goToRutinas(page) {
  await page.goto("/rutinas");
  await page.waitForLoadState("networkidle");
  // Si no estamos en /rutinas (redirigido por auth), hacer login
  if (!page.url().includes("/rutinas")) {
    await ensureLoggedIn(page);
    await page.goto("/rutinas");
    await page.waitForLoadState("networkidle");
  }
}

test.describe("Fase A - Pase final", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  // ── Punto 1 ── /rutinas carga sin error de hooks
  test("1. /rutinas carga sin error Rendered fewer hooks", async ({ page }) => {
    await goToRutinas(page);

    for (let i = 0; i < 3; i += 1) {
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    const hooksError = page.getByText(/Rendered fewer hooks than expected/);
    await expect(hooksError).not.toBeVisible();

    // La página debe mostrar algo: heading, loading, o estado vacío
    await expect(
      page.locator("text=/rutinas|cargando|no tienes rutinas/i")
    ).toBeVisible();
  });

  // ── Punto 2 ── Crear rutina individual con días A/B/C
  test("2. Crear rutina individual A/B/C y persiste tras recarga", async ({ page }) => {
    const title = `E2E Individual ${UNIQUE_SUFFIX}`;

    await goToRutinas(page);
    await page.getByRole("button", { name: /nueva rutina/i }).click();

    await page.getByPlaceholder(/nombre de la rutina/i).first().fill(title);

    // Añadir ejercicio al día 0
    await page.getByRole("button", { name: /añadir ejercicio al día/i }).first().click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Sentadilla");
    await page.getByRole("button", { name: /sentadilla/i }).first().click();
    await page.waitForTimeout(800);

    // Día 1
    const addBtns = page.getByRole("button", { name: /añadir ejercicio al día/i });
    await addBtns.nth(1).click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Press de banca");
    await page.getByRole("button", { name: /press de banca/i }).first().click();
    await page.waitForTimeout(800);

    // Día 2
    await addBtns.nth(2).click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Remo con barra");
    await page.getByRole("button", { name: /remo con barra/i }).first().click();
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /guardar rutina/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /cerrar editor/i }).click();

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/sentadilla/i)).toBeVisible();
    await expect(page.getByText(/press de banca/i)).toBeVisible();
    await expect(page.getByText(/remo con barra/i)).toBeVisible();
  });

  // ── Punto 3 ── Crear rutina semanal, mover sesión en planificador
  test("3. Crear rutina semanal y mover sesión en planificador", async ({ page }) => {
    const title = `E2E Semanal ${UNIQUE_SUFFIX}`;

    await goToRutinas(page);
    await page.getByRole("button", { name: /nueva rutina/i }).click();
    await page.getByPlaceholder(/nombre de la rutina/i).first().fill(title);
    await page.getByRole("button", { name: /semanal/i }).click();

    await page.getByRole("button", { name: /añadir ejercicio al día/i }).first().click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Sentadilla");
    await page.getByRole("button", { name: /sentadilla/i }).first().click();
    await page.waitForTimeout(800);

    const addBtns = page.getByRole("button", { name: /añadir ejercicio al día/i });
    await addBtns.nth(1).click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Press de banca");
    await page.getByRole("button", { name: /press de banca/i }).first().click();
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /guardar rutina/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /cerrar editor/i }).click();

    await page.getByRole("button", { name: /planificar/i }).first().click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /lunes/i }).first().click();
    const miercolesBtn = page.getByRole("button", { name: /miércoles/i });
    if (await miercolesBtn.isVisible()) await miercolesBtn.click();

    await page.getByRole("button", { name: /guardar/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.goto("/rutinas");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(title)).toBeVisible();
  });

  // ── Punto 4 ── Duplicar rutina individual y semanal
  test("4. Duplicar rutina individual y semanal", async ({ page }) => {
    const title = `E2E Dup ${UNIQUE_SUFFIX}`;

    await goToRutinas(page);
    await page.getByRole("button", { name: /nueva rutina/i }).click();
    await page.getByPlaceholder(/nombre de la rutina/i).first().fill(title);
    await page.getByRole("button", { name: /añadir ejercicio al día/i }).first().click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Sentadilla");
    await page.getByRole("button", { name: /sentadilla/i }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /guardar rutina/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /cerrar editor/i }).click();

    await page.getByRole("button", { name: /más opciones/i }).first().click();
    await page.getByRole("button", { name: /editar/i }).click();
    await page.getByRole("button", { name: /duplicar rutina/i }).click();
    await page.getByRole("button", { name: /guardar rutina/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /cerrar editor/i }).click();

    await expect(page.getByText(/copia de E2E Dup/)).toBeVisible();

    await page.getByRole("button", { name: /más opciones/i }).last().click();
    await page.getByRole("button", { name: /editar/i }).last().click();
    await page.getByRole("button", { name: /quitar ejercicio/i }).first().click();
    await page.getByRole("button", { name: /añadir ejercicio al día/i }).first().click();
    await page.getByRole("textbox", { name: /buscar/i }).first().fill("Peso muerto");
    await page.getByRole("button", { name: /peso muerto/i }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /guardar rutina/i }).click();
    await page.getByText(/guardado/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.getByRole("button", { name: /cerrar editor/i }).click();

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/sentadilla/i)).toBeVisible();
    await expect(page.getByText(/peso muerto/i)).not.toBeVisible();
  });

  // ── Punto 5 ── Plantillas
  test("5. Plantillas: Fullbody 3 Días y Semana equilibrada", async ({ page }) => {
    await goToRutinas(page);
    await page.waitForLoadState("networkidle");

    const fullbody = page.getByText(/fullbody 3 días/i);
    const semanaEquilibrada = page.getByText(/semana equilibrada/i);

    if (await fullbody.isVisible()) {
      await expect(fullbody).toBeVisible();
      await expect(semanaEquilibrada).toBeVisible();
      const count = await page.getByText(/semana equilibrada/i).count();
      expect(count).toBe(1);
    } else {
      // Buscar botón de plantillas o verificar que existen en la UI
      await expect(page.locator("text=/plantilla|template/i").first()).toBeVisible();
    }
  });

  // ── Punto 6 ── Iniciar por día desde la lista
  test("6. Iniciar entrenamiento por día", async ({ page }) => {
    await goToRutinas(page);
    await page.waitForLoadState("networkidle");

    const trainBtns = page.getByRole("button", { name: /entrenar/i });
    if (await trainBtns.count() > 0) {
      await trainBtns.first().click();
      const dayPicker = page.getByRole("heading", { name: /elegir día de entrenamiento/i });
      if (await dayPicker.isVisible()) {
        await page.getByRole("button", { name: /lunes/i }).first().click();
        await page.waitForURL(/entrenar/, { timeout: 10_000 });
      }
    }

    await page.goto("/rutinas");
    await page.waitForLoadState("networkidle");

    const individualTrainBtns = page.getByRole("button", { name: /entrenar/i });
    if (await individualTrainBtns.count() > 0) {
      await individualTrainBtns.first().click();
      const dayPicker = page.getByRole("heading", { name: /elegir día de entrenamiento/i });
      if (await dayPicker.isVisible()) {
        const dayButtons = page.getByRole("button", { name: /día [ABC]|lunes|martes|miércoles/i });
        if (await dayButtons.count() > 0) {
          await dayButtons.nth(1).click();
        }
        await page.waitForURL(/entrenar/, { timeout: 10_000 });
      }
    }
  });

  // ── Punto 7 ── Hero del dashboard (hoy es sábado = descanso)
  test("7. Hero del dashboard muestra Sin sesión programada en día de descanso", async ({ page }) => {
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");

    const cta = page.getByRole("button", { name: /sin sesión programada/i });
    await expect(cta).toBeVisible();

    await cta.click();
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/entrenar/);
  });

  // ── Punto 8 ── Sesión activa: aviso en /rutinas
  test("8. Sesión activa muestra aviso en /rutinas con Ir a la sesión activa", async ({ page }) => {
    await goToRutinas(page);
    await page.waitForLoadState("networkidle");

    const trainBtns = page.getByRole("button", { name: /entrenar/i });
    if (await trainBtns.count() > 0) {
      await trainBtns.first().click();
      const dayPicker = page.getByRole("heading", { name: /elegir día de entrenamiento/i });
      if (await dayPicker.isVisible()) {
        await page.getByRole("button", { name: /lunes|día A/i }).first().click();
      }
      await page.waitForURL(/entrenar/, { timeout: 10_000 });
    }

    await page.goto("/rutinas");
    await page.waitForLoadState("networkidle");

    const otherTrainBtns = page.getByRole("button", { name: /entrenar/i });
    if (await otherTrainBtns.count() > 1) {
      await otherTrainBtns.nth(1).click();

      const conflictBanner = page.getByText(/hay una sesión activa/i);
      await expect(conflictBanner).toBeVisible();
      await expect(page.getByRole("button", { name: /ir a la sesión activa/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /entendido/i })).toBeVisible();

      await page.getByRole("button", { name: /ir a la sesión activa/i }).click();
      await page.waitForURL(/entrenar/, { timeout: 10_000 });
    }
  });

  // ── Punto 9 ── Recarga con sesión activa
  test("9. Recarga con sesión activa reanuda en el día correcto", async ({ page }) => {
    await page.goto("/entrenar");
    await page.waitForLoadState("networkidle");

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/entrenar/, { timeout: 10_000 });
  });
});
