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

const TAGS = {
  MESSAGE_TYPE: 1,    // Pour le type de message (response, error, etc.)
  CONTENT: 2,        // Pour le contenu du message
  SERVER_ID: 3,      // Pour l'ID du serveur
};

const encodeTLV = (data) => {
  let chunks = [];
  
  // Encoder le type de message
  if (data.type) {
    const typeBuffer = new TextEncoder().encode(data.type);
    const typeChunk = new Uint8Array(1 + 4 + typeBuffer.length);
    typeChunk[0] = TAGS.MESSAGE_TYPE;
    const typeDv = new DataView(typeChunk.buffer);
    typeDv.setUint32(1, typeBuffer.length, false);
    typeChunk.set(typeBuffer, 5);
    chunks.push(typeChunk);
  }

  // Encoder le contenu
  if (data.message) {
    const contentBuffer = new TextEncoder().encode(data.message);
    const contentChunk = new Uint8Array(1 + 4 + contentBuffer.length);
    contentChunk[0] = TAGS.CONTENT;
    const contentDv = new DataView(contentChunk.buffer);
    contentDv.setUint32(1, contentBuffer.length, false);
    contentChunk.set(contentBuffer, 5);
    chunks.push(contentChunk);
  }

  // Encoder le serverId
  if (data.serverId) {
    const serverIdBuffer = new TextEncoder().encode(data.serverId);
    const serverIdChunk = new Uint8Array(1 + 4 + serverIdBuffer.length);
    serverIdChunk[0] = TAGS.SERVER_ID;
    const serverIdDv = new DataView(serverIdChunk.buffer);
    serverIdDv.setUint32(1, serverIdBuffer.length, false);
    serverIdChunk.set(serverIdBuffer, 5);
    chunks.push(serverIdChunk);
  }

  // Calculer la taille totale
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const finalBuffer = new Uint8Array(totalLength);
  
  // Combiner tous les chunks
  let offset = 0;
  for (const chunk of chunks) {
    finalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  return finalBuffer;
}

const decodeTLV = (buffer) => {
  const result = {};
  let offset = 0;

  while (offset < buffer.length) {
    const tag = buffer[offset];
    const dv = new DataView(buffer.buffer, offset + 1);
    const length = dv.getUint32(0, false);
    const value = new TextDecoder().decode(
      buffer.slice(offset + 5, offset + 5 + length)
    );

    switch (tag) {
      case TAGS.MESSAGE_TYPE:
        result.type = value;
        break;
      case TAGS.CONTENT:
        result.message = value;
        break;
      case TAGS.SERVER_ID:
        result.serverId = value;
        break;
    }

    offset += 5 + length;
  }

  result.rawBuffer = Array.from(buffer);
  return result;
}

await fastify.register(websocket, {
  options: {
    maxPayload: 1048576,
    clientTracking: true
  },
  preClose: async (done) => {
    const server = fastify.websocketServer
    
    for (const client of server.clients) {
      const shutdownMessage = encodeTLV({
        type: 'shutdown',
        serverId: SERVER_ID,
        message: 'Server shutting down gracefully'
      });
      client.send(shutdownMessage);
      client.close(1000, 'Server shutting down gracefully');
    }
    
    server.close(done)
  }
})

await fastify.register(async function (fastify) {
  fastify.get('/', { websocket: true }, (socket, req) => {
    console.log('Client connecté')
    
    const serverInfo = encodeTLV({
      type: 'server_info',
      serverId: SERVER_ID,
      message: 'Connexion WebSocket établie!'
    });
    socket.send(serverInfo);

    // Chaos: Déconnexion aléatoire périodique
    const chaosInterval = setInterval(() => {
      if (chaosConfig.enabled && Math.random() < chaosConfig.randomDisconnectProbability) {
        console.log('Chaos: Déconnexion forcée du client');
        const chaosMessage = encodeTLV({
          type: 'chaos',
          message: 'Déconnexion forcée'
        });
        socket.send(chaosMessage);
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

        const decoded = decodeTLV(new Uint8Array(message));
        console.log('Message reçu:', decoded);
        
        const response = encodeTLV({
          type: 'response',
          serverId: SERVER_ID,
          message: `Serveur ${SERVER_ID} a reçu: ${decoded.message}`
        });
        
        socket.send(response);
      } catch (error) {
        console.error('Erreur:', error);
        const errorResponse = encodeTLV({
          type: 'error',
          serverId: SERVER_ID,
          message: `Erreur: ${error.message}`
        });
        socket.send(errorResponse);
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