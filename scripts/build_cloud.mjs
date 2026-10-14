import {build} from 'esbuild';
await build({entryPoints:['scripts/cloud-client.mjs'],outfile:'assets/cloud-client.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true});
