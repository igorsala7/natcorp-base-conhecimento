import { test, expect } from "@playwright/test";

test.describe("Fumaça (smoke)", () => {
  test("a página de login do admin carrega com o formulário", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
  });

  test("rota não autenticada do admin redireciona para o login", async ({ page }) => {
    await page.goto("/admin/conteudo");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("o portal público responde (servidor no ar)", async ({ page }) => {
    // Com Supabase real, isto é 200/404; na CI (Supabase placeholder) pode ser
    // 5xx — aqui só garantimos que o servidor respondeu (não travou/caiu).
    const res = await page.goto("/docs/global");
    expect(res).not.toBeNull();
    expect(res!.status()).toBeLessThan(600);
  });
});
