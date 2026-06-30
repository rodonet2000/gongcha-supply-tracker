import { chromium } from 'playwright'

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

const logs = []
page.on('console', (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} - ${req.failure()?.errorText}`))

const responses = []
page.on('response', (res) => {
  if (res.url().includes('gongcha.rodosoft.digital') || res.url().includes('5.252.53.169')) {
    responses.push(`${res.status()} ${res.request().method()} ${res.url()}`)
  }
})

console.log('1. Navigating to login page...')
await page.goto('https://gongcha.rodosoft.digital/login', { waitUntil: 'networkidle', timeout: 30000 })
console.log('   URL:', page.url())

console.log('\n2. Filling login form...')
await page.fill('input[name="email"]', 'admin@gongcha.mx')
await page.fill('input[name="password"]', 'GonCha2026!')

console.log('\n3. Cookies BEFORE submit:')
let cookies = await context.cookies()
console.log('  ', cookies.map(c => c.name))

console.log('\n4. Clicking submit and waiting for navigation...')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => console.log('   (networkidle timeout, continuing)')),
  page.click('button[type="submit"]'),
])

// Wait a bit more to let any redirects settle
await page.waitForTimeout(3000)

console.log('\n5. Final URL:', page.url())

console.log('\n6. Cookies AFTER submit:')
cookies = await context.cookies()
for (const c of cookies) {
  console.log(`   ${c.name} = ${c.value.slice(0, 60)}... (domain=${c.domain}, httpOnly=${c.httpOnly}, secure=${c.secure})`)
}

console.log('\n7. Page content check:')
const bodyText = await page.textContent('body').catch(() => '')
console.log('   Has "Credenciales incorrectas":', bodyText.includes('Credenciales incorrectas'))
console.log('   Has "Dashboard":', bodyText.includes('Dashboard') || bodyText.includes('Insumos'))
console.log('   Has login form still:', bodyText.includes('Ingresar') || bodyText.includes('Correo'))

console.log('\n8. Network requests to gongcha/VPS:')
responses.forEach(r => console.log('  ', r))

console.log('\n9. Console/page logs:')
logs.forEach(l => console.log('  ', l))

await browser.close()
