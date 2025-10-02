const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Serve the HTML file
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server for signaling
const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('🔌 New client connected');
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 Received:', message.type);
            
            if (message.type === 'join') {
                const roomId = message.room;
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                    console.log('🎯 New room created:', roomId);
                }
                rooms.get(roomId).add(ws);
                ws.room = roomId;
                ws.userName = message.userName || 'Anonymous';
                
                // Notify others in the room
                rooms.get(roomId).forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'user-joined',
                            userName: ws.userName
                        }));
                    }
                });
                
                ws.send(JSON.stringify({ type: 'joined', room: roomId }));
                console.log('👤 User joined room:', roomId);
            }
            
            // Broadcast to other clients in the same room
            if (ws.room && rooms.has(ws.room) && message.type !== 'join') {
                rooms.get(ws.room).forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(message));
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('🔌 Client disconnected');
        if (ws.room && rooms.has(ws.room)) {
            // Notify others about user leaving
            rooms.get(ws.room).forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'user-left',
                        userName: ws.userName
                    }));
                }
            });
            
            rooms.get(ws.room).delete(ws);
            if (rooms.get(ws.room).size === 0) {
                rooms.delete(ws.room);
                console.log('🗑️  Room deleted:', ws.room);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('🔌 WebSocket server ready on ws://localhost:' + PORT);
    console.log('📁 Serving from directory:', __dirname);
});