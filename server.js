const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const port = 9999;
let adresses = new Set()
server.on('message', (msg, rinfo) => {
    console.log(`Alınan mesaj: ${msg} ${rinfo.address}:${rinfo.port}`);

    const decodedBuffer = Buffer.from(msg.toString(), 'base64');

    const header = decodedBuffer.subarray(0, 10);

    const packet = decodedBuffer.subarray(10);

    if (header == "pakethello") {
        if (adresses.has(`${rinfo.address}:${rinfo.port}`)) return;
        server.send('ping', rinfo.port, rinfo.address, (err) => {
            adresses.add(`${rinfo.address}:${rinfo.port}`);
            if (err) console.error(err);
            else console.log('Cevap gönderildi');
        });
    } else if (header == "packetsend") {
        if(!adresses.has(`${rinfo.address}:${rinfo.port}`)) {
            const buffer = Buffer.concat([
                Buffer.from("packetwhor")
              ]);
            return  server.send(buffer.toString("base64"), rinfo.port, rinfo.address, (err) => {
                if (err) console.error(err);
                else console.log('Kim bu la');
            });
        }
        console.log('Header:', header.toString());
        console.log('Packet:', packet.toString());
        adresses.forEach(x=>{
            if(`${rinfo.address}:${rinfo.port}` == x) return;
            
   const buffer = Buffer.concat([
    Buffer.from("packetgent"),
    Buffer.from(packet)
  ]);
            server.send(buffer.toString("base64"), x.port, x.address, (err) => {
                if (err) console.error(err);
                else console.log('Cevap gönderildi');
            });
        })
    }

});

server.on('error', (err) => {
    console.error(`Sunucu hatası:\n${err.stack}`);
    server.close();
});

server.bind(port, () => {
    console.log('Sunucu dinleniyor...');
});
