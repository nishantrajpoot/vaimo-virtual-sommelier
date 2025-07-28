import wineData from "../data/mock-data.json" assert { type: "json" }

console.log("=== WINE URL ANALYSIS ===\n")

console.log(`Total wines in dataset: ${wineData.data.length}\n`)

// Check first 5 wines and their URLs
console.log("Sample wine URLs:")
wineData.data.slice(0, 5).forEach((wine, index) => {
  console.log(`${index + 1}. ${wine.productName}`)
  console.log(`   URL: ${wine.link}`)
  console.log(`   Image: ${wine.image}`)
  console.log(`   Price: €${wine.price}`)
  console.log("")
})

// Check if all wines have URLs
const winesWithUrls = wineData.data.filter((wine) => wine.link && wine.link.trim() !== "")
const winesWithoutUrls = wineData.data.filter((wine) => !wine.link || wine.link.trim() === "")

console.log(`Wines with URLs: ${winesWithUrls.length}`)
console.log(`Wines without URLs: ${winesWithoutUrls.length}`)

if (winesWithoutUrls.length > 0) {
  console.log("\nWines missing URLs:")
  winesWithoutUrls.forEach((wine, index) => {
    console.log(`${index + 1}. ${wine.productName} (ID: ${wine._id})`)
  })
}

// Check URL patterns
console.log("\nURL patterns:")
const urlPatterns = {}
winesWithUrls.forEach((wine) => {
  try {
    const url = new URL(wine.link)
    const domain = url.hostname
    urlPatterns[domain] = (urlPatterns[domain] || 0) + 1
  } catch (e) {
    console.log(`Invalid URL: ${wine.link}`)
  }
})

Object.entries(urlPatterns).forEach(([domain, count]) => {
  console.log(`${domain}: ${count} wines`)
})

// Test a few URLs
console.log("\n=== TESTING SAMPLE URLS ===")
const sampleUrls = wineData.data.slice(0, 3).map((wine) => wine.link)

sampleUrls.forEach((url, index) => {
  console.log(`\nTesting URL ${index + 1}: ${url}`)

  try {
    const urlObj = new URL(url)
    console.log(`✓ Valid URL structure`)
    console.log(`  Domain: ${urlObj.hostname}`)
    console.log(`  Path: ${urlObj.pathname}`)

    // Check if it's a Delhaize URL
    if (urlObj.hostname.includes("delhaize")) {
      console.log(`✓ Delhaize URL confirmed`)
    } else {
      console.log(`⚠ Not a Delhaize URL`)
    }
  } catch (error) {
    console.log(`✗ Invalid URL: ${error.message}`)
  }
})
