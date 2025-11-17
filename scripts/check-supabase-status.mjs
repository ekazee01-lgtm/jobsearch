import { chromium } from 'playwright'

/**
 * Fetches the Supabase status page and prints the headline status along with
 * the first few significant lines so we can see current incidents/notes.
 */
async function run() {
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://status.supabase.com', { waitUntil: 'networkidle' })

    await page.waitForLoadState('domcontentloaded')
    const title = await page.title()
    const bodyText = await page.evaluate(() => document.body.innerText)
    const lines = bodyText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const snippet = lines.slice(0, 20).join('\n')
    console.log(`Page title: ${title}`)
    console.log('Top page excerpt:')
    console.log(snippet)

    await browser.close()
}

run().catch((error) => {
    console.error('Failed to check Supabase status:', error)
    process.exitCode = 1
})
