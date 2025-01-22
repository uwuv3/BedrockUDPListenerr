const net = require('net');
const port = 9999;
class ServerSide {
    constructor() {
        this.sockets = new Set();
        this.createServer()
    }
    /**
     * 
     * @param {net.Socket} socket 
     * @param {*} data 
     */
    onSocketData(socket, data) {
        const decodedBuffer = Buffer.from(data.toString(), 'base64');
        const header = decodedBuffer.subarray(0, 10);
        const packet = decodedBuffer.subarray(10);
         if(header.toString() == "clientconn") {
            socket.write(makePacket("yenurom"),()=>{
                this.sockets.add(socket);
                console.log(`[SERVER] New user`);
            })
         }  if(header.toString() == "getusers") {
            if(!this.sockets.has(socket)) return socket.write(makePacket("whoareyou"));
            socket.write(makePacket("userslist"),()=>{
                this.sockets.add(socket);
                console.log(`[SERVER] New user`);
            })
         }
    }
    createServer() {
        if (this.server && this.server.destroyed) return;
        this.server = net.createServer((socket) => {
            console.log(`[SERVER] New Connection: ${socket.remoteAddress}:${socket.remotePort}`);
            socket.on("data", (data) => {
                this.onSocketData(socket, data)
            });
            socket.on('error', (err) => {
                console.error(`Bağlantı hatası: ${err.message}`);
            });

            socket.on('end', () => {
                console.log(`Bağlantı kapandı: ${socket.remoteAddress}:${socket.remotePort}`);
                if (this.sockets.has(socket)) this.sockets.delete(socket);
            });
        });
        this.server.listen(port);
        this.server.on("close", () => {
            console.log("[SERVER] Socket Closed, re-trying after 1 second");
            setTimeout(() => {
                this.sockets = new Set();
                this.createServer();
            }, 1000)
        })
    }
}
new ServerSide();

function makePacket(name, msg) {
    if (name.length > 10) return console.log(`[PACKET] ${name} is not defined`);
    if (!msg) msg = "none";
    const buffer = Buffer.concat([
        Buffer.from(name),
        Buffer.from(msg)
    ]);
    return buffer.toString("base64")
}