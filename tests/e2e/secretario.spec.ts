import { test, expect } from '@playwright/test'

// Credenciais do seed
const ADMIN = { email: 'ricardo@osasco.sp.gov.br', senha: 'senha123' }
const DEMANDANTE = { email: 'demandante@osasco.sp.gov.br', senha: 'senha123' }

async function login(page: any, email: string, senha: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', senha)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard|portal/, { timeout: 10000 })
}

test.describe('Aprovação do Secretário', () => {

  test('Admin consegue criar secretaria e usuário secretário', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.senha)

    // Vai para admin
    await page.goto('/portal/admin')
    await expect(page).toHaveURL(/admin/)

    // Verifica que a seção Secretarias existe
    await expect(page.getByText('Secretarias')).toBeVisible()
    await expect(page.getByText('+ Nova Secretaria')).toBeVisible()

    // Cria uma secretaria de teste
    await page.click('text=+ Nova Secretaria')
    await page.fill('input[required]', 'Secretaria de Teste E2E')
    await page.click('text=Salvar')

    // Verifica que aparece na lista
    await expect(page.getByText('Secretaria de Teste E2E')).toBeVisible()
  })

  test('Admin consegue criar usuário SECRETARIO com secretaria', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.senha)
    await page.goto('/portal/admin')

    // Clica em novo usuário
    await page.click('text=+ Novo Usuário')

    // Preenche o formulário
    await page.fill('input[placeholder*="Nome"], input[name*="name"]', 'Secretário Teste')
    await page.fill('input[type="email"]', 'secretario.teste@osasco.sp.gov.br')
    await page.fill('input[type="password"]', 'senha123')

    // Seleciona papel SECRETARIO
    await page.selectOption('select', 'SECRETARIO')

    // Aguarda dropdown de secretaria aparecer
    await expect(page.getByText('Secretaria')).toBeVisible()
    await page.selectOption('select >> nth=1', { label: 'Secretaria de Teste E2E' })

    await page.click('text=Salvar')
    await expect(page.getByText('Secretário Teste')).toBeVisible()
  })

  test('Secretário vê painel de aprovações em /portal/secretario', async ({ page }) => {
    await login(page, 'secretario.teste@osasco.sp.gov.br', 'senha123')

    await page.goto('/portal/secretario')
    await expect(page.getByText('Painel do Secretario')).toBeVisible()
    await expect(page.getByText('Aguardando Aprovacao')).toBeVisible()
  })

  test('Usuário sem role SECRETARIO não acessa /portal/secretario', async ({ page }) => {
    await login(page, DEMANDANTE.email, DEMANDANTE.senha)

    await page.goto('/portal/secretario')
    // Deve ser redirecionado para dashboard
    await expect(page).toHaveURL(/dashboard/)
  })

  test('Sidebar mostra link Aprovações para SECRETARIO', async ({ page }) => {
    await login(page, 'secretario.teste@osasco.sp.gov.br', 'senha123')
    await expect(page.getByText('Aprovações')).toBeVisible()
  })

  test('Demandante vê campos Detalhes da Missão desabilitados', async ({ page }) => {
    await login(page, DEMANDANTE.email, DEMANDANTE.senha)

    // Cria nova solicitação
    await page.goto('/portal/solicitacoes/nova')

    // Campos justificativaPublica e nexoCargo devem estar desabilitados
    const justField = page.locator('textarea[disabled]').first()
    await expect(justField).toBeDisabled()

    // Badge "Preenchimento do Secretário" deve estar visível
    await expect(page.getByText('Preenchimento do Secretário')).toBeVisible()
  })

})
