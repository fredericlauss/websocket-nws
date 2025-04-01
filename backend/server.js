import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { v4 as uuidv4 } from 'uuid'

const fastify = Fastify()
const SERVER_ID = uuidv4()
console.log(`Instance du serveur démarrée avec l'ID: ${SERVER_ID}`)

const chaosConfig = {
  enabled: true,
  randomDisconnectProbability: 0.1,
  maxLatency: 2000,
  errorProbability: 0.1
}

// Fonction pour introduire un délai aléatoire
const randomDelay = () => {
  return new Promise(resolve => {
    setTimeout(resolve, Math.random() * chaosConfig.maxLatency);
  });
}

await fastify.register(websocket, {
  options: {
    maxPayload: 1048576,
    clientTracking: true
  },
  preClose: async (done) => {
    const server = fastify.websocketServer
    
    for (const client of server.clients) {
      client.send(JSON.stringify({
        type: 'shutdown',
        serverId: SERVER_ID,
        message: 'Server shutting down gracefully'
      }))
      client.close(1000, 'Server shutting down gracefully')
    }
    
    server.close(done)
  }
})

await fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, (socket, req) => {
    console.log('Client connecté')
    
    socket.send(JSON.stringify({
      type: 'server_info',
      serverId: SERVER_ID,
      message: 'Connexion WebSocket établie!'
    }))

    // Chaos: Déconnexion aléatoire périodique
    const chaosInterval = setInterval(() => {
      if (chaosConfig.enabled && Math.random() < chaosConfig.randomDisconnectProbability) {
        console.log('Chaos: Déconnexion forcée du client');
        socket.close(1000, 'Chaos engineering: random disconnect');
      }
    }, 5000);

    socket.on('message', async (message) => {
      try {
        if (chaosConfig.enabled) {
          await randomDelay();
        }

        if (chaosConfig.enabled && Math.random() < chaosConfig.errorProbability) {
          console.log('Chaos: Génération d\'une erreur');
          throw new Error('Chaos engineering: random error');
        }

        const data = JSON.parse(message.toString())
        console.log('Message reçu:', data)
        
        socket.send(JSON.stringify({
          type: 'response',
          serverId: SERVER_ID,
          message: `Serveur ${SERVER_ID} a reçu: ${data.message}`
        }))
      } catch (error) {
        console.error('Erreur:', error)
        socket.send(JSON.stringify({
          type: 'error',
          serverId: SERVER_ID,
          message: `Erreur: ${error.message}`
        }))
      }
    })

    socket.on('close', () => {
      console.log('Client déconnecté')
      clearInterval(chaosInterval);
    })
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