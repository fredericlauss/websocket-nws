import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [serverId, setServerId] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [lastServerId, setLastServerId] = useState(null)

  const TAGS = {
    MESSAGE_TYPE: 1,
    CONTENT: 2,
    SERVER_ID: 3
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

  const connectWebSocket = () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    const ws = new WebSocket('ws://localhost:3000/');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('Connecté au serveur WebSocket');
      setSocket(ws);
      setIsConnecting(false);
    }

    ws.onmessage = (event) => {
      const decoded = decodeTLV(new Uint8Array(event.data));

      if (decoded.type === 'server_info') {
        if (lastServerId && lastServerId === decoded.serverId) {
          console.log('Reconnexion à la même instance du serveur, fermeture...');
          ws.close();
          return;
        }
        setLastServerId(serverId);
        setServerId(decoded.serverId);
      } else if (decoded.type === 'shutdown') {
        setMessages(prev => [...prev, 'Le serveur s\'arrête...']);
      }

      setMessages(prev => [...prev, {
        text: decoded.message,
        binary: decoded.rawBuffer.join(',')
      }]);
    }

    ws.onclose = () => {
      console.log('Déconnecté du serveur WebSocket');
      setSocket(null);
      setServerId(null);
      setIsConnecting(false);
      
      // Tentative de reconnexion après 3 secondes
      setTimeout(() => {
        console.log('Tentative de reconnexion...');
        connectWebSocket();
      }, 3000);
    }

    ws.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
      ws.close();
    }
  }

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
    }
  }, [])

  const sendMessage = () => {
    if (socket) {
      const message = encodeTLV({
        type: 'message',
        message: `Message test ${count}`
      });
      socket.send(message);
    }
  }

  return (
    <>
      <h1>Vite + React + WebSocket</h1>
      {serverId && (
        <div className="server-info">
          Connecté au serveur: {serverId}
        </div>
      )}
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={sendMessage}>
          Envoyer un message WebSocket
        </button>
        <div>
          <h3>Messages WebSocket:</h3>
          <ul>
            {messages.map((msg, index) => (
              <li key={index}>
                {typeof msg === 'string' ? msg : (
                  <>
                    <div>Message: {msg.text}</div>
                    <div className="binary">Binaire: {msg.binary}</div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export default App
