import { readFile, writeFile } from 'node:fs/promises'

export default function itemsEditor() {
  let pending = Promise.resolve()
  return {
    name: 'development-items-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/items', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        if (req.headers.origin !== `http://${req.headers.host}`) {
          res.statusCode = 403; res.end('Use the development site to add items.'); return
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 4096) { res.statusCode = 413; res.end('Item details are too long.'); return }
            chunks.push(chunk)
          }
          let data
          try { data = JSON.parse(Buffer.concat(chunks).toString()) } catch {
            res.statusCode = 400; res.end('Invalid item details.'); return
          }
          const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
          const topic = clean(data?.topic)
          const name = clean(data?.name)
          if (!topic || !name || topic.length > 120 || name.length > 120) {
            res.statusCode = 400; res.end('Enter a topic and item name, up to 120 characters each.'); return
          }
          const save = pending.then(async () => {
            const file = new URL('./src/items.json', import.meta.url)
            const topics = JSON.parse(await readFile(file, 'utf8'))
            let section = topics.find(section => section.topic.toLowerCase() === topic.toLowerCase())
            if (!section) { section = { topic, items: [] }; topics.push(section) }
            if (section.items.some(item => item.toLowerCase() === name.toLowerCase())) return false
            section.items.push(name)
            await writeFile(file, JSON.stringify(topics, null, 2) + '\n')
            return true
          })
          pending = save.catch(() => {})
          if (!await save) { res.statusCode = 409; res.end('That item already exists in this topic.'); return }
          res.end('Item added.')
        } catch {
          res.statusCode = 500; res.end('Could not save the item. Please try again.')
        }
      })
    },
  }
}
