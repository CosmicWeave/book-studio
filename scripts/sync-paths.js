import fs from 'fs';
import path from 'path';

const BASE_PATH = '/book-studio';

const prefixPath = (s) => {
  if (s.startsWith('/') && !s.startsWith(BASE_PATH)) {
    return BASE_PATH + s;
  }
  return s;
};

// Sync manifest.json
if (fs.existsSync('manifest.json')) {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.icons.forEach(icon => {
    icon.src = prefixPath(icon.src);
  });
  manifest.start_url = prefixPath(manifest.start_url);
  if (manifest.share_target) {
    manifest.share_target.action = prefixPath(manifest.share_target.action);
  }
  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log('Updated manifest.json');
}

// Sync sw.js
const swPath = 'public/sw.js';
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  
  // Prefix local assets in ASSETS_TO_CACHE
  sw = sw.replace(/ASSETS_TO_CACHE = \[([^]*?)\]/, (match, content) => {
    const updatedContent = content.replace(/'\/(.*?)'/g, (m, path) => {
      if (path.includes('://')) return m;
      return `'${BASE_PATH}/${path}'`;
    });
    return `ASSETS_TO_CACHE = [${updatedContent}]`;
  });

  // Fix other hardcoded paths
  sw = sw.replace(/url\.pathname === '\/share-target\/'/g, `url.pathname === '${BASE_PATH}/share-target/'`);
  sw = sw.replace(/Response\.redirect\('\/',/g, `Response.redirect('${BASE_PATH}/',`);
  sw = sw.replace(/cache\.put\('\/index\.html'/g, `cache.put('${BASE_PATH}/index.html'`);
  sw = sw.replace(/caches\.match\('\/index\.html'/g, `caches.match('${BASE_PATH}/index.html'`);

  fs.writeFileSync(swPath, sw);
  console.log('Updated public/sw.js');
}
