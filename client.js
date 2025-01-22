const { exec, execSync } = require("child_process");
const net = require("net")
const serverIP = "localhost";
const serverPort = 9999;
const dgram = require("dgram");
const ms = require("ms");
const os = require("os");
//i need to know what packet to do, because when he connects someone, other udp packets needs to be closed

class ClientSide {
    constructor() {
        openUDP();
        this.connectClient();
    }
    connectClient() {
        if (this.server && !this.server.destroyed) return;
        this.server = new net.Socket();
        this.server.connect(serverPort, serverIP, () => {
            console.log('[CLIENT] Connected to the server');
            this.server.write(makePacket("clientconn"), (err) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log('[CLIENT] Send clienthello');
                    this.serverTimeout = setTimeout(() => {
                        console.log(`[CLIENT] No Data given, aborting...`);
                        try {
                            this.server.destroy()
                        } catch (error) {
                            console.log(error)
                        }
                        setTimeout(() => {
                            this.connectClient();
                        }, 1000)
                    }, 5000)
                }
            });
        });
        this.server.on("data", (data) => {
            this.onPacketServer(data)
        });
        this.server.on("error", (e) => {
            console.log(e)
            console.log("[CLIENT] Socket Closed, re-trying after 1 second");
            setTimeout(() => {
                this.connectClient();
            }, 1000)
        })
    }
    onPacketServer(data) {
        const decodedBuffer = Buffer.from(data.toString(), 'base64');
        const header = decodedBuffer.subarray(0, 10);
        const packet = decodedBuffer.subarray(10);
        if (header.toString() == "yenuromnon") {
            console.log("[CLIENT] Server Connected!")
            if (this.serverTimeout) clearTimeout(this.serverTimeout);
            this.onClientConnect()
        }
        if (header.toString() == "whoareyoun") {
            this.server.emit("error", "Server dont know u")
        } if (header.toString() == "userslistn") {
            this.createUDPConnections(parseInt(packet.toString()));
        }
    }
    onClientConnect() {
        this.findMCPE()
        //this.server.write(makePacket("getusers"), (err) => { })

    }
    createUDPConnections(length) {
    }
    async findMCPE() {
        this.port = findMCPort();
        this.skipPorts = new Set();
        console.log(this.port)
        for (const portInfo of this.port) {
            const port = portInfo.ip.split(':')[1];
            if (!this.skipPorts.has(port)) { 
                this.listenOnUDPPort(port);
            } else {
                console.debug(`Port ${port} zaten dinleniyor, atlanıyor.`);
            }
        }
    
        await new Promise((a) => setTimeout(() => a(), 2000));
        
        if (!this.port || !this.port.port) {
            this.findMCPE();
        }
    }
    onMcPacket(packet) {
        this.server.write(makePacket("packetmcp",packet), (err) => {if(!err) console.log("Packet sended") })
    }
    listenOnUDPPort(port) {
        let lastMessage = Date.now();
        const server = dgram.createSocket('udp4');
    
        setInterval(() => {
            if (lastMessage < Date.now()) {
                try {
                    server.close();
                    this.findMCPE();
                } catch (error) {
                    console.error("Socket kapatılamadı: ", error);
                }
            }
        }, 2000);
    
        server.on('listening', () => {
            const address = server.address();
            console.debug(`Listening on UDP port ${JSON.stringify(address)}`);
        });
    
        server.on('message', (msg, rinfo) => {
            lastMessage = Date.now() + ms("15s");
            console.debug(`Received message: ${msg} from ${rinfo.address}:${rinfo.port}`);
            this.onMcPacket(msg)
            this.port = { port: rinfo.port, server };
        });
    
        server.on("close", () => {
            this.port = undefined;
        });
    
        server.on("error", (text) => {
            if (text.toString().includes("EADDRINUSE")) {
                this.skipPorts.add(port);
                try {
                    server.close();
                } catch (error) {
                    console.error("Port kapatılırken hata oluştu:", error);
                }
            } else {
                this.findMCPE();
                console.error(text);
            }
        });
    
        server.bind(port,getLocalIP(), () => { });
        return server;
    }
    
}

new ClientSide();
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
        for (const addr of interfaces[iface]) {
            if (addr.family === 'IPv4' && addr.address !== '127.0.0.1') {
                return addr.address;
            }
        }
    }
    return '0.0.0.0';
}
function findMCPort() {
    try {
        const tasklistOutput = execSync('tasklist /FI "IMAGENAME eq Minecraft.Windows.exe"', { encoding: 'utf-8' });

        const lines = tasklistOutput.split('\n');
        let minecraftPid = null;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Minecraft.Windows.exe')) {
                const parts = lines[i].trim().split(/\s+/);
                minecraftPid = parts[1];
                break;
            }
        }

        if (!minecraftPid) {
            console.log('Minecraft UWP çalışmıyor veya bulunamadı.');
            return []
        }

        //     console.log(`Minecraft PID bulundu: ${minecraftPid}`);

        const netstatOutput = execSync('netstat -a -p UDP -o', { encoding: 'utf-8' });

        const udpConnections = netstatOutput.split('\n').filter(line => line.includes(minecraftPid)).map(x => {
            const regex = /(\w+)\s+(\d+\.\d+\.\d+\.\d+:\d+)\s+\*\:\*\s+(\d+)/;
            const match = regex.exec(x);
            if (match) {
                return ({
                    type: match[1],
                    ip: match[2],
                    pid: match[3]
                });
            }
        })

        //      console.log(`Minecraft UWP UDP Bağlantıları:\n${udpConnections.join('\n')}`);
        return udpConnections

    } catch (err) {
        console.error('Hata oluştu:', err);
        return []
    }
}

function makePacket(name, msg) {
    if (name.length > 10) return console.log(`[PACKET] ${name} is not defined`);
    if (!msg) msg = "none";
    const buffer = Buffer.concat([
        Buffer.from(name),
        Buffer.from(msg)
    ]);
    return buffer.toString("base64")
}

function openUDP() {
    exec(`CheckNetIsolation LoopbackExempt -a -n=\"Microsoft.MinecraftUWP_8wekyb3d8bbwe\"`)
}