const net = require('net');
const port = 9999;

class ServerSide {
    constructor() {
        this.clients = new Map(); // Store client info
        this.createServer();
    }

    createServer() {
        this.server = net.createServer((socket) => {
            console.log(`[SERVER] New connection: ${socket.remoteAddress}`);
            
            socket.on("data", (data) => this.handlePacket(socket, data));
            socket.on("error", () => this.removeClient(socket));
            socket.on("end", () => this.removeClient(socket));
        }).listen(port);
    }

    removeClient(socket) {
        this.clients.delete(socket);
        this.broadcastClients();
    }

    handlePacket(socket, data) {
        try {
            const decoded = Buffer.from(data.toString(), 'base64');
            const header = decoded.subarray(0, 10).toString();
            const packet = decoded.subarray(10);

            switch(header) {
                case "clientconn":
                    this.handleNewClient(socket);
                    break;
                case "portupdate":
                    this.updateClientPort(socket, packet.toString());
                    break;
                case "mcpepacket":
                    this.broadcastPacket(socket, packet);
                    break;
            }
        } catch (err) {
            console.error(`[SERVER] Packet error: ${err.message}`);
        }
    }

    handleNewClient(socket) {
        this.clients.set(socket, {
            address: socket.remoteAddress,
            ports: new Set()
        });
        socket.write(makePacket("connected"));
        this.broadcastClients();
    }

    updateClientPort(socket, port) {
        console.log(`${socket.address()} update ${port}`)
        const client = this.clients.get(socket);
        if (client) {
            client.ports.add(port);
            this.broadcastClients();
        }
    }

    broadcastClients() {
        const clientList = Array.from(this.clients.entries())
            .map(([_, info]) => ({
                ip: info.address,
                ports: Array.from(info.ports)
            }));
        
        const data = makePacket("clientlist", JSON.stringify(clientList));
        this.clients.forEach((_, socket) => socket.write(data));
    }

    broadcastPacket(sender, packet) {
        const senderInfo = this.clients.get(sender);
        if (!senderInfo) return;
 
        const data = makePacket("mcpepacket", JSON.stringify({
            from: senderInfo.address,
            data: packet.toString()
        }));
        this.clients.forEach((_, socket) => {
            if (socket !== sender) socket.write(data);
        });
    }
}

new ServerSide();
function makePacket(name, msg = "") {
    return Buffer.concat([
        Buffer.from(name.padEnd(10)),
        Buffer.from(msg)
    ]).toString('base64');
}