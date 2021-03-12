require('esbuild')
  .build({
    entryPoints: ['src/app.ts'],
    bundle: false,
    platform: 'node',
    format: 'cjs',
    outfile: 'dist/app.js',
  })
  .catch(() => process.exit(1))
