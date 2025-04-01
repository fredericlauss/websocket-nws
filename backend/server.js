const fastify = require('fastify')()

// Enregistrement du plugin WebSocket
fastify.register(require('@fastify/websocket'), {
  options: {
    maxPayload: 1048576,
    clientTracking: true
  }
})

// Enregistrement des routes dans un plugin séparé
fastify.register(async function (fastify) {
  // Route WebSocket simple
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

    // Message de bienvenue
    socket.send(JSON.stringify({
      type: 'welcome',
      message: 'Connexion WebSocket établie!'
    }))
  })
})

// Démarrage du serveur
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