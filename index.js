const { execSync } = require("child_process");
const fs = require("fs");
const dgram = require("dgram")
const log = console.log;
const debug = console.debug;
const ms = require("ms")
const logStream = fs.createWriteStream('log.txt', { flags: 'a' });

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
(async () => {
    const exec = execSync(`CheckNetIsolation LoopbackExempt -a -n=\"Microsoft.MinecraftUWP_8wekyb3d8bbwe\"`);
    console.log(exec.toString());

    setInterval(() => {
        if (!connectedPort && lastMessage < Date.now()) {
            getUDPPorts();
            setTimeout(() => {
                udpPorts.forEach((portInfo) => {
                    const port = portInfo.ip.split(':')[1];
                    listenOnUDPPort(port)
                })
            }, 1000)
        }
    }, 5000);

})();
function onPacketRecieve(packet, rinfo) {
    let type = new Buffer(packet, 'hex').readUInt8(0);
    //246 -> idle
    //145 -> in-game
    console.log(type)
}
function listenOnUDPPort(port) {
    const server = dgram.createSocket('udp4');

    server.on('listening', () => {
        const address = server.address();
        console.log(`Listening on UDP port ${JSON.stringify(address)}`);
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
                server.disconnect()
            } catch (error) {

            }
        } else {
            console.error(text)
        }
    })
    server.bind(port, () => {
        console.log(`Server bound to port ${port}`);
    });
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
