const fastify = require('fastify')()

fastify.register(require('@fastify/websocket'), {
  options: {
    maxPayload: 1048576,
    clientTracking: true
  },
  preClose: async (done) => {
    const server = fastify.websocketServer
    
    for (const client of server.clients) {
      client.close(1000, 'Server shutting down gracefully')
    }
    
    server.close(done)
  }
})

fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, (socket, req) => {
    console.log('Client connecté')
    
    socket.on('message', message => {
      try {
        const data = JSON.parse(message.toString())
        console.log('Message reçu:', data)
        
        socket.send(JSON.stringify({
          type: 'response',
          message: `Serveur a reçu: ${data.message}`
        }))
      } catch (error) {
        console.error('Erreur:', error)
      }
    })

    socket.on('close', () => {
      console.log('Client déconnecté')
    })

    socket.send(JSON.stringify({
      type: 'welcome',
      message: 'Connexion WebSocket établie!'
    }))
  })
})

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} signal reçu. Début de l'arrêt gracieux...`)

  try {
    await fastify.close()
    console.log('Serveur arrêté avec succès')
    process.exit(0)
  } catch (err) {
    console.error('Erreur pendant l\'arrêt du serveur:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse non gérée:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Exception non capturée:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
    console.log('Serveur démarré sur le port 3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()