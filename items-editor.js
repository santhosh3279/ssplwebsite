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
            if (size > 16384) { res.statusCode = 413; res.end('Item details are too long.'); return }
            chunks.push(chunk)
          }
          let data
          try { data = JSON.parse(Buffer.concat(chunks).toString()) } catch {
            res.statusCode = 400; res.end('Invalid item details.'); return
          }
          const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
          const topic = clean(data?.topic)
          if (data?.action === 'delete-topic' || data?.action === 'delete-item') {
            const name = clean(data.name)
            if (!topic || (data.action === 'delete-item' && !name)) {
              res.statusCode = 400; res.end('Choose a topic or item to remove.'); return
            }
            const remove = pending.then(async () => {
              const file = new URL('./src/items.json', import.meta.url)
              const topics = JSON.parse(await readFile(file, 'utf8'))
              const index = topics.findIndex(section => section.topic === topic)
              if (index < 0) return false
              if (data.action === 'delete-topic') topics.splice(index, 1)
              else {
                const itemIndex = topics[index].items.indexOf(name)
                if (itemIndex < 0) return false
                topics[index].items.splice(itemIndex, 1)
              }
              await writeFile(file, JSON.stringify(topics, null, 2) + '\n')
              return true
            })
            pending = remove.catch(() => {})
            if (!await remove) { res.statusCode = 404; res.end('This topic or item no longer exists.'); return }
            res.end(data.action === 'delete-topic' ? 'Section removed.' : 'Item removed.'); return
          }
          const names = typeof data?.name === 'string' ? data.name.split(',').map(clean).filter(Boolean) : []
          if (!topic || !names.length || topic.length > 120 || names.length > 100 || names.some(name => name.length > 120)) {
            res.statusCode = 400; res.end('Enter a topic and up to 100 comma-separated items, up to 120 characters each.'); return
          }
          const save = pending.then(async () => {
            const file = new URL('./src/items.json', import.meta.url)
            const topics = JSON.parse(await readFile(file, 'utf8'))
            let section = topics.find(section => section.topic.toLowerCase() === topic.toLowerCase())
            if (!section) { section = { topic, items: [] }; topics.push(section) }
            const seen = new Set(section.items.map(item => item.toLowerCase()))
            let added = 0
            for (const name of names) {
              if (seen.has(name.toLowerCase())) continue
              seen.add(name.toLowerCase())
              section.items.push(name)
              added++
            }
            if (!added) return 0
            await writeFile(file, JSON.stringify(topics, null, 2) + '\n')
            return added
          })
          pending = save.catch(() => {})
          const added = await save
          if (!added) { res.statusCode = 409; res.end('All these items already exist in this topic.'); return }
          res.end(`${added} item${added === 1 ? '' : 's'} added.`)
        } catch {
          res.statusCode = 500; res.end('Could not save the item. Please try again.')
        }
      })
    },
  }
}
