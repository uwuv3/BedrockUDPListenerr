const net = require('net');
const port = 9999;
let addresses = new Set();

const server = net.createServer((socket) => {
    console.log(`Yeni bir bağlantı: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
        console.log(`Alınan mesaj: ${data} ${socket.remoteAddress}:${socket.remotePort}`);

        const decodedBuffer = Buffer.from(data.toString(), 'base64');
        const header = decodedBuffer.subarray(0, 10);
        const packet = decodedBuffer.subarray(10);

        if (header.toString() === "pakethello") {
            if (addresses.has(`${socket.remoteAddress}:${socket.remotePort}`)) return;
            addresses.add(`${socket.remoteAddress}:${socket.remotePort}`);

            socket.write(Buffer.from('ping').toString('base64'), (err) => {
                if (err) console.error(err);
                else console.log('Cevap gönderildi');
            });

        } else if (header.toString() === "packetsend") {
            if (!addresses.has(`${socket.remoteAddress}:${socket.remotePort}`)) {
                const buffer = Buffer.concat([
                    Buffer.from("packetwhor")
                ]);
                socket.write(buffer.toString('base64'), (err) => {
                    if (err) console.error(err);
                    else console.log('Kim bu la');
                });
                return;
            }

            console.log('Header:', header.toString());
            console.log('Packet:', packet.toString());

            addresses.forEach((address) => {
                const [remoteAddress, remotePort] = address.split(':');
                if (`${socket.remoteAddress}:${socket.remotePort}` === address) return;

                const buffer = Buffer.concat([
                    Buffer.from("packetgent"),
                    Buffer.from(packet)
                ]);

                // Yeni bir TCP soket bağlantısı aç
                const client = net.createConnection({ host: remoteAddress, port: remotePort }, () => {
                    client.write(buffer.toString('base64'), (err) => {
                        if (err) console.error(err);
                        else console.log('Mesaj iletildi');
                    });
                });

                client.on('error', (err) => {
                    console.error(`Soket hatası: ${err.message}`);
                });

                client.end();
            });
        }
    });

    socket.on('error', (err) => {
        console.error(`Bağlantı hatası: ${err.message}`);
    });

    socket.on('end', () => {
        console.log(`Bağlantı kapandı: ${socket.remoteAddress}:${socket.remotePort}`);
        addresses.delete(`${socket.remoteAddress}:${socket.remotePort}`);
    });
});

server.listen(port, () => {
    console.log(`Sunucu ${port} portunda dinleniyor...`);
});
