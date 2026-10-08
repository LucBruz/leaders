// Serveur statique minimal pour regarder les prototypes visuels dans le
// panneau navigateur. Rien à voir avec l'application : `npm run dev` reste
// le serveur Nuxt.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../prototype/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const PORT = 4321

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json; charset=utf-8',
}

createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const rel = url === '/' ? 'standees.html' : url.slice(1)
    // Empêche de sortir du dossier prototype.
    const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
    try {
        const body = await readFile(path)
        res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
        res.end(body)
    } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('introuvable : ' + rel)
    }
}).listen(PORT, () => console.log(`prototypes servis sur http://localhost:${PORT}`))
