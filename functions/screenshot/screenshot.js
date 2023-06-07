const chromium = require("chrome-aws-lambda")
const defaults = require("lodash.defaults")
const qs = require("qs")
const regexMerge = require("regex-merge")

const pattern = regexMerge(
  /^(?:\/\.netlify\/functions)?/,
  /(?:\/screenshot)?/,
  /(?:\/(?<width>[0-9]+)x(?<height>[0-9]+))?/,
  /(?<path>\/.*?)/,
  /(?:\.png)?$/,
)

const options = {
  base: process.env.BASE_URL,
  width: 1280,
  height: 720,
  maxage: 60 * 60 * 24 * 7,
}

exports.handler = async (event, context) => {
  const { base, path, width, height, maxage } = (() => {
    const settings = defaults(event.path.match(pattern).groups, options)

    settings.width = parseInt(settings.width)
    settings.height = parseInt(settings.height)

    return settings
  })()

  const url = `${base}${path}${qs.stringify(event.queryStringParameters, { addQueryPrefix: true })}`

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  })

  const page = await browser.newPage()

  await page.setViewport({ width, height })

  await page.goto(url, { waitUntil: "networkidle2" })

  const screenshot = await page.screenshot()

  await browser.close()

  return {
    statusCode: 200,
    headers: {
      "Cache-Control": `public, max-age=${maxage}`,
      "Content-Type": "image/png",
      "Expires": new Date(Date.now() + maxage * 1000).toUTCString(),
    },
    body: screenshot.toString("base64"),
    isBase64Encoded: true,
  }
}
