const { exec, execSync } = require("child_process");
const net = require("net");
const dgram = require("dgram");
const os = require("os");

const serverIP = "localhost";
const serverPort = 9999;
class ClientSide {
    constructor() {
        this.udpPorts = new Map();
        this.mcPorts = new Set();
        this.init();
        this.portOffsets = new Map();
        this.skipPorts = new Set()
    }

    async init() {
        await this.enableUWPLoopback();
        this.connectTCP();
        this.startMCPortDetection();
    }

    async enableUWPLoopback() {
        await exec('CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"');
    }

    connectTCP() {
        this.socket = new net.Socket();
        
        this.socket.connect(serverPort, serverIP, () => {
            console.log('[CLIENT] Connected to server');
            this.socket.write(makePacket("clientconn"));
        });

        this.socket.on("data", data => this.handleServerPacket(data));
        this.socket.on("error", () => setTimeout(() => this.connectTCP(), 1000));
    }

    async startMCPortDetection() {
        while (true) {
            try {
                const ports = await this.findMCPorts();
                for (const portInfo of ports) {
                    const port = portInfo.ip.split(':')[1];
                    if (!this.mcPorts.has(port)) {
                        this.listenToGamePort(port);
                    }
                }
            } catch (err) {
                console.error('[CLIENT] Port detection error:', err);
            }
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    findMCPorts() {
        try {
            const tasklistOutput = execSync('tasklist /FI "IMAGENAME eq Minecraft.Windows.exe"', { encoding: 'utf-8' });
            const minecraftPid = tasklistOutput.split('\n')
                .find(line => line.includes('Minecraft.Windows.exe'))
                ?.split(/\s+/)[1];

            if (!minecraftPid) return [];

            const netstatOutput = execSync('netstat -a -p UDP -o', { encoding: 'utf-8' });
            return netstatOutput.split('\n')
                .filter(line => line.includes(minecraftPid))
                .map(line => {
                    const match = /(\w+)\s+(\d+\.\d+\.\d+\.\d+:\d+)\s+\*\:\*\s+(\d+)/.exec(line);
                    return match ? {
                        type: match[1],
                        ip: match[2],
                        pid: match[3]
                    } : null;
                })
                .filter(Boolean);
        } catch (err) {
            console.error('[CLIENT] Port scan error:', err);
            return [];
        }
    }
    listenToGamePort(port) {
        if (this.skipPorts.has(port)) return;

        const socket = dgram.createSocket('udp4');
        
        socket.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.skipPorts.add(port);
            }
            socket.close();
            this.mcPorts.delete(port);
        });

        socket.on('message', (msg) => {
            this.socket.write(makePacket("mcpepacket", JSON.stringify({
                data: msg.toString('base64'),
                originalPort: port
            })));
        });

        socket.bind(port, getLocalIP(), () => {
            this.mcPorts.add(port);
            this.socket.write(makePacket("portupdate", port.toString()));
        });
    }


    handleServerPacket(data) {
        try {
            const decoded = Buffer.from(data.toString(), 'base64');
            const header = decoded.subarray(0, 10).toString();
            const packet = decoded.subarray(10);

            switch(header) {
                case "clientlist":
                    this.updatePeerConnections(JSON.parse(packet));
                    break;
                case "mcpepacket":
                    this.handleGamePacket(JSON.parse(packet.toString()));
                    break;
            }
        } catch (err) {
            console.error('[CLIENT] Packet handling error:', err);
        }
    }
    updatePeerConnections(clients) {
        for (const [ip] of this.udpPorts) {
            if (!clients.some(c => c.ip === ip)) {
                this.udpPorts.get(ip).close();
                this.udpPorts.delete(ip);
            }
        }

        for (const client of clients) {
            if (!this.udpPorts.has(client.ip)) {
                const socket = dgram.createSocket('udp4');
                socket.bind(0, getLocalIP());
                this.udpPorts.set(client.ip, socket);
            }
        }
    }

    handleGamePacket({from, data, originalPort}) {
        const packet = Buffer.from(data, 'base64');
        const socket = this.udpPorts.get(from);
        if (socket) {
            this.mcPorts.forEach(port => {
                const offset = this.getPortOffset(from, originalPort);
                const targetPort = parseInt(port) + offset;
                socket.send(packet, targetPort, 'localhost');
            });
        }
    }
    getPortOffset(clientIP, originalPort) {
        if (!this.portOffsets.has(clientIP)) {
            // Generate unique offset for each client (0-1000 range)
            const offset = Math.floor(Math.random() * 1000);
            this.portOffsets.set(clientIP, offset);
        }
        return this.portOffsets.get(clientIP);
    }
}

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        const ipv4 = iface.find(addr => addr.family === 'IPv4' && !addr.internal);
        if (ipv4) return ipv4.address;
    }
    return '0.0.0.0';
}
new ClientSide();
function makePacket(name, msg = "") {
    return Buffer.concat([
        Buffer.from(name.padEnd(10)),
        Buffer.from(msg)
    ]).toString('base64');
}