const { writeFileSync } = require('fs');
const net = require('net');
const port = 9999;

let sockets = new Set();

const server = net.createServer((socket) => {
    console.log(`Yeni bir bağlantı: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', (data) => {
        console.log(`Alınan mesaj: ${data} ${socket.remoteAddress}:${socket.remotePort}`);

        const decodedBuffer = Buffer.from(data.toString(), 'base64');
        const header = decodedBuffer.subarray(0, 10);
        const packet = decodedBuffer.subarray(10);
        if (header.toString() == "pakethello") {
            if (sockets.has(socket)) return;

            socket.write(Buffer.from('ping').toString('base64'), (err) => {
                sockets.add(socket);
                if (err) console.error(err);
                else console.log('Cevap gönderildi');
            });

        } else if (header.toString() === "packetsend") {
            if (!sockets.has(socket)) {
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
            writeFileSync("./t", packet)
            sockets.forEach((clientSocket) => {
                if (clientSocket === socket) return;

                const buffer = Buffer.concat([
                    Buffer.from("packetgent"),
                    Buffer.from(packet)
                ]);

                clientSocket.write(buffer.toString('base64'), (err) => {
                    if (err) console.error(err);
                    else console.log('Mesaj iletildi');
                });
            });
        }
    });

    socket.on('error', (err) => {
        console.error(`Bağlantı hatası: ${err.message}`);
    });

    socket.on('end', () => {
        console.log(`Bağlantı kapandı: ${socket.remoteAddress}:${socket.remotePort}`);
        sockets.delete(socket);
    });
});

server.listen(port, () => {
    console.log(`Sunucu ${port} portunda dinleniyor...`);
});
