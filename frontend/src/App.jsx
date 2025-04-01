import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [serverId, setServerId] = useState(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/')

    ws.onopen = () => {
      console.log('Connecté au serveur WebSocket')
      setSocket(ws)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'server_info') {
        setServerId(data.serverId)
      }
      setMessages(prev => [...prev, `${data.message}`])
    }

    ws.onclose = () => {
      console.log('Déconnecté du serveur WebSocket')
      setServerId(null)
    }

    return () => {
      if (ws) {
        ws.close()
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
