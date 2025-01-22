const { execSync } = require("child_process");
const fs = require("fs");
const dgram = require("dgram")
const log = console.log;
const debug = console.debug;
const ms = require("ms")
const logStream = fs.createWriteStream('log.txt', { flags: 'a' });
const serverIp = "localhost";
const serverPort = 9999;
const net = require('net');
console.log = (...args) => {
    log(`[LOG] ${new Date().toISOString()} - ${args.join(' ')}`);
    logStream.write(`[LOG] ${new Date().toISOString()} - ${args.join(' ')}\n`);
};

console.debug = (...args) => {

    logStream.write(`[DEBUG] ${new Date().toISOString()} - ${args.join(' ')}\n`);
    if (process.argv.includes("log")) {
        debug(`[DEBUG] ${new Date().toISOString()} - ${args.join(' ')}`);
    }
};
console.error = (...args) => {
    logStream.write(`[ERROR] ${new Date().toISOString()} - ${args.join(' ')}\n`);

    debug(`[ERROR] ${new Date().toISOString()}`);
    debug(...args)
};
let udpPorts = [];
let skipPorts = new Set();
let connectedPort;
let lastMessage = Date.now();

const socket = new net.Socket();
(async () => {
    await new Promise((resolve, reject) => {
        let connect = false;

        socket.connect(serverPort, serverIp, () => {
            console.log('Sunucuya bağlandım');

            socket.write(Buffer.from("pakethello").toString("base64"), (err) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    console.log('Mesaj gönderildi');
                }
            });
        });

        socket.on('data', (msg) => {
            connect = true;
            console.debug(`Alınan mesaj: ${msg.toString()} sunucudan`);

            const decodedBuffer = Buffer.from(msg.toString(), 'base64');
            const header = decodedBuffer.subarray(0, 10);
            const packet = decodedBuffer.subarray(10);
            if (header.toString() === "packetwhor") {
                console.log("Sen kimsin lan");
                process.exit();
            }

            if (header.toString() === "packetgent") {
                console.log("Askımdanmesajvar");
            }

            if (decodedBuffer.toString() === "ping") {
                resolve();
            }
        });

        socket.on('error', (err) => {
            console.error(`Hata: ${err.message}`);
            reject(err);
        });

        socket.on('close', () => {
            console.log('Bağlantı kapandı');
            process.exit()
        });

        setTimeout(() => {
            if (!connect) {
                console.error("Sunucuya bağlanamadım");
                process.exit();
            }
        }, 5000);
    });

    const exec = execSync(`CheckNetIsolation LoopbackExempt -a -n=\"Microsoft.MinecraftUWP_8wekyb3d8bbwe\"`);
    console.log(exec.toString());
    checkPackets()
    setInterval(() => {
        if (!connectedPort && lastMessage < Date.now()) {
            checkPackets()
        }
    }, 5000);
    function checkPackets() {
        getUDPPorts();
        setTimeout(() => {
            udpPorts.forEach((portInfo) => {
                const port = portInfo.ip.split(':')[1];
                if (!skipPorts.has(port))
                    listenOnUDPPort(port)
            })
        }, 1000)
    }
})();
function onPacketRecieve(packet, rinfo) {
    //let type = Buffer.from(packet, 'hex').readUInt8(0);
    //246 -> idle
    //145 -> in-game
    //37 -> friends
    //43 -> ???
    //212 -> smth better
    //250 -> connecting

    // console.log(type)
    const buffer = Buffer.concat([
        Buffer.from("packetsend"),
        Buffer.from(packet)
    ]);
    socket.write(buffer.toString("base64"))
}
function listenOnUDPPort(port) {
    const server = dgram.createSocket('udp4');

    server.on('listening', () => {
        const address = server.address();
        console.debug(`Listening on UDP port ${JSON.stringify(address)}`);
    });
    server.on('message', (msg, rinfo) => {
        lastMessage = Date.now() + ms("15s")
        console.debug(`Received message: ${msg} from ${rinfo.address}:${rinfo.port}`);
        onPacketRecieve(msg, rinfo)
    });
    server.on("error", (text) => {
        if (text.toString().includes("EADDRINUSE")) {
            console.debug(text);
            skipPorts.add(port);
            try {
                server.close()
            } catch (error) {

            }
        } else {
            console.error(text)
        }
    })
    server.bind(port, () => { });
} async function getUDPPorts() {
    try {
        const stdout = execSync("netstat -a -p UDP -o");
        const ports = [];

        stdout.toString().split("\n").forEach(line => {
            console.debug(`[NETSTAT] ${line}`);
            const regex = /(\w+)\s+(\d+\.\d+\.\d+\.\d+:\d+)\s+\*\:\*\s+(\d+)/;
            const match = regex.exec(line);
            if (match) {
                ports.push({
                    type: match[1],
                    ip: match[2],
                    pid: match[3]
                });
            }

        });
        udpPorts = ports;
        console.debug(`UDP ports: ${JSON.stringify(udpPorts)}`);
    } catch (error) {
        console.error(`Error fetching UDP ports: ${error.message}`);
    }

}
