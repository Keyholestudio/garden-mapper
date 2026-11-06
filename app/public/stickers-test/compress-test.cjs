const sharp = require('sharp')
const path = require('path')

const srcDir = 'C:/Users/RG/.openclaw/workspace/projects/garden-planner/app/public/stickers'
const outDir = 'C:/Users/RG/.openclaw/workspace/projects/garden-planner/app/public/stickers-test'

const tests = [
  'decor_gazebo-oct_XL_CA-US-FR-GB-AU.png',
  'tree-deciduous_magnolia_XXL_CA-US-FR-GB-AU.png',
  'herb-small_basil_S_CA-US-FR-GB-AU.png'
]

async function run() {
  for (const f of tests) {
    const inp = path.join(srcDir, f)
    await sharp(inp).png({ compressionLevel: 9, palette: false }).toFile(path.join(outDir, 'COMPRESSED_PNG9_' + f))
    console.log('PNG9 done:', f)
    const webpName = f.replace(/\.png$/, '.webp')
    await sharp(inp).webp({ quality: 85 }).toFile(path.join(outDir, 'COMPRESSED_WEBP85_' + webpName))
    console.log('WEBP85 done:', webpName)
  }
  console.log('All done')
}
run().catch(console.error)
