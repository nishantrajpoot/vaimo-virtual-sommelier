#!/usr/bin/env node
// Script to add a random 'id' field to every wine entry in the data JSON files
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

// Directory containing the data JSON files
const dataDir = path.resolve(__dirname, '../data')
// List of JSON files to process
const files = ['data_EN.json', 'data_FR.json', 'data_NL.json']

files.forEach((fileName) => {
  const filePath = path.join(dataDir, fileName)
  const raw = fs.readFileSync(filePath, 'utf-8')
  let wines
  try {
    wines = JSON.parse(raw)
  } catch (err) {
    console.error(`Error parsing ${fileName}:`, err)
    process.exit(1)
  }
  if (!Array.isArray(wines)) {
    console.error(`${fileName} does not contain a JSON array`)
    process.exit(1)
  }
  const updated = wines.map((wine) => {
    return { id: randomUUID(), ...wine }
  })
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n')
  console.log(`Added IDs to ${fileName} (${wines.length} entries)`)  
})
