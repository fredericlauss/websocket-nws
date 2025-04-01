import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [serverId, setServerId] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [lastServerId, setLastServerId] = useState(null)

  const connectWebSocket = () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    const ws = new WebSocket('ws://localhost:3000/');

    ws.onopen = () => {
      console.log('Connecté au serveur WebSocket');
      setSocket(ws);
      setIsConnecting(false);
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'server_info') {
        if (lastServerId && lastServerId === data.serverId) {
          console.log('Reconnexion à la même instance du serveur, fermeture...');
          ws.close();
          return;
        }
        setLastServerId(serverId);
        setServerId(data.serverId);
      } else if (data.type === 'shutdown') {
        setMessages(prev => [...prev, 'Le serveur s\'arrête...']);
      }
      setMessages(prev => [...prev, `${data.message}`]);
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
      socket.send(JSON.stringify({
        type: 'message',
        message: `Message test ${count}`
      }))
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
              <li key={index}>{msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

export default App
