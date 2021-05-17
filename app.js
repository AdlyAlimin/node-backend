const whatsapp = require('./wa_modules')
const express = require('express')
const http = require('http')
const fs = require('fs')
const { phoneNumberFormatter } = require('./helpers/formatter');
const port = process.env.PORT || 3000;
require('dotenv').config()

const app = express()
const server = http.createServer(app)

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

const sessions = [];

whatsapp.createSessionsFileIfNotExists()

function initApplication(){
    const savedSessions = whatsapp.getSessionsFile();
    if (savedSessions.length > 0) {
        savedSessions.forEach(sess => {
            whatsapp.createSession(sess.id, sessions).catch(err => console.log('connection close'));
        });
    }
}

//CREATE DEVICE
app.post('/create-device', (req, res) => {
    const id_device = req.body.id_device;
    const description = req.body.description;
    const token = req.body.token;

    if(token == process.env.APIKEY){
        whatsapp.createSession(id_device, sessions)
        res.status(200).json({
            status: true,
            msg: "Sukses menambah device",
            response: []
        });
    }else{
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});

app.post('/reset-device', (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        const client = sessions.find(sess => sess.id == id_device).client;
        client.close();
        let sess = `./session/whatsapp-session-${id_device}.json`;
        if (fs.existsSync(sess)) {
            fs.unlinkSync(sess, function (err) {
                if (err) return console.log(err);
                console.log('Session file deleted!');
            });
        }
        const savedSessions = whatsapp.getSessionsFile();
        const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
        if(sessionIndex && savedSessions[sessionIndex].ready == true){
            savedSessions[sessionIndex].ready = false;
            whatsapp.setSessionsFile(savedSessions);
        }
        whatsapp.createSession(id_device, sessions)
        res.status(200).json({
            status: true,
            msg: "Sukses reset device",
            response: []
        });
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});

app.post('/delete-session', (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if(token == process.env.APIKEY){
        // const client = sessions.find(sess => sess.id == id_device).client;
        // client.close();
        // sleep(2000);
        // const savedSessions = whatsapp.getSessionsFile();
        // const sessionIndex = savedSessions.findIndex(sess => sess.id == id_device);
        // savedSessions.splice(sessionIndex, 1);
        // whatsapp.setSessionsFile(savedSessions);
        // let sess = `./session/whatsapp-session-${id_device}.json`;
        // if (fs.existsSync(sess)) {
        //     console.log('Session file deleted!');
        //     fs.unlinkSync(sess, function (err) {
        //         if (err) return console.log(err);
        //     });
        // }
        //whatsapp.createSession(id_device, sessions)
        whatsapp.deleteDevice(id_device);
        
        res.status(200).json({
            status: true,
            msg: "Sukses reset device",
            response: []
        });
    }else{
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});

app.post('/get-battery', async (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if(token == process.env.APIKEY){
        whatsapp.batteryDevice(id_device);

        res.status(200).json({
            status: true,
            msg: "Sukses reset device",
            response: []
        });
    }else{
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});

app.post('/check-number', async (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;
    const nomor = phoneNumberFormatter(req.body.nomor);

    if (token == process.env.APIKEY) {
        const client = sessions.find(sess => sess.id == id_device).client;
        let verify = await whatsapp.checkNumber(client, nomor);
        if (verify !== undefined) {
            res.status(200).json({
                status: true,
                msg: "Nomor ada whatsapp",
                response: []
            });
        } else {
            res.status(200).json({
                status: false,
                msg: "Nomor tidak ada whatsapp",
                response: []
            });
        }

    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});
  

app.post('/send', async (req, res) => {
    let id_device = req.body.id_device
    let number = phoneNumberFormatter(req.body.number)
    let message = req.body.message
    let file = req.body.file
    const token = req.body.token;

    console.log(id_device)

    if(token == process.env.APIKEY){
        try{
            const client = sessions.find(sess => sess.id == id_device).client;
            //CHECK NUMBER
            if(await whatsapp.checkNumber(client, number) === undefined){
                return res.status(200).json({
                    status: false,
                    msg: 'The number is not registered',
                    data: {}
                });
            }else{
                // await whatsapp.fakeTyping(client, number)
                if(file != null){
                    await whatsapp.sendMedia(client, number, message, file)
                }else{
                    await whatsapp.sendText(client, number, message)
                }  
                res.status(200).json({
                    status: true,
                    msg: "Berhasil kirim pesan",
                    response: []
                })
            }
        }catch(err) {
            res.status(200).json({
                status: false,
                msg: "Gagal",
                response: [err.message]
            })
        }
    }else{
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
})

app.post('/send-group', async (req, res) => {
    let id_device = req.body.id_device
    //let number = phoneNumberFormatter(req.body.number)
    let group = req.body.group
    let message = req.body.message
    let file = req.body.file
    const token = req.body.token;

    if(token == process.env.APIKEY){
        try{
            const client = sessions.find(sess => sess.id == id_device).client;
            let number = await whatsapp.findGroupByName(client, group)
            if(number){
                //await whatsapp.fakeTyping(client, number)
                if (file != null) {
                    await whatsapp.sendMedia(client, number, message, file)
                } else {
                    await whatsapp.sendText(client, number, message)
                }
                res.status(200).json({
                    status: true,
                    msg: "Berhasil kirim pesan",
                    response: []
                })
            }else{
                res.status(200).json({
                    status: false,
                    msg: "Group tidak terdaftar (case sensitive)",
                    response: []
                })
            }
        }catch(err) {
            res.status(200).json({
                status: false,
                msg: "Gagal",
                response: [err.message]
            })
        }
    }else{
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
})

app.post('/get-groups', async (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        try {
            const client = sessions.find(sess => sess.id == id_device).client
            let final = []
            let contact = await whatsapp.getGroups(client)
            contact.forEach((group, i) => {
                let g = group.name
                final.push(g)
            })
            res.status(200).json({
                status: true,
                msg: "Berhasil mendapatkan group",
                response: final
            })
        } catch(err) {
            res.status(200).json({
                status: false,
                msg: "Client tidak ditemukan",
                response: [err.message]
            })
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        })
    }
})

app.post('/get-groups-2', async (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        try {
            const client = sessions.find(sess => sess.id == id_device).client
            let contact = await whatsapp.getGroups(client)
            res.status(200).json({
                status: true,
                msg: "Berhasil mendapatkan group",
                response: contact
            })
        } catch(err) {
            res.status(200).json({
                status: false,
                msg: "Client tidak ditemukan",
                response: [err.message]
            })
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        })
    }
})

app.post('/get-group-participants', async (req, res) => {
    let id_device = req.body.id_device
    //let number = phoneNumberFormatter(req.body.number)
    let group = req.body.group
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        try{
            const client = sessions.find(sess => sess.id == id_device).client;
            let number = await whatsapp.findGroupByName(client, group)
            if(number){
                let metadata = await whatsapp.getGroupMetadata(client, number)
                //await whatsapp.fakeTyping(client, number)
                res.status(200).json({
                    status: true,
                    msg: "Berhasil kirim pesan",
                    response: metadata['participants']
                })
            }else{
                res.status(200).json({
                    status: false,
                    msg: "Group tidak terdaftar (case sensitive)",
                    response: []
                })
            }
        }catch(err) {
            res.status(200).json({
                status: false,
                msg: "Gagal",
                response: [err.message]
            })
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        })
    }
})

app.post('/get-contact', async (req, res) => {
    let id_device = req.body.id_device
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        try{
            const client = sessions.find(sess => sess.id == id_device).client;
            let contact = await whatsapp.getContacts(client)
            res.status(200).json({
                status: true,
                msg: "Berhasil kirim pesan",
                response: contact
            })
        }catch(err) {
            res.status(200).json({
                status: false,
                msg: "Gagal",
                response: [err.message]
            })
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        })
    }
})

app.post('/get-chat-list', async (req, res) => {
    const id_device = req.body.id_device;
    const token = req.body.token;

    if (token == process.env.APIKEY) {
        try {
            const client = sessions.find(sess => sess.id == id_device).client;
            let chat = await whatsapp.getChatsList(client);
            chat = chat.sort(function(x, y){
                return y.timestamp - x.timestamp;
            })
            res.status(200).json({
                status: true,
                msg: "Berhasil mendapatkan chat",
                response: chat
            });
        } catch (err) {
            res.status(200).json({
                status: false,
                msg: "Kesalahan",
                response: [err.message]
            });
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});

app.post('/get-chat-detail', async (req, res) => {
    const id_device = req.body.id_device
    const number = phoneNumberFormatter(req.body.number)
    const token = req.body.token
    console.log(number)

    if (token == process.env.APIKEY) {
        try {
            const client = sessions.find(sess => sess.id == id_device).client;
            let chat = await whatsapp.getChatDetail(client, number);
            // chat = chat.sort(function(x, y){
            //     return x.timestamp - y.timestamp;
            // })
            res.status(200).json({
                status: true,
                msg: "Berhasil mendapatkan chat",
                response: chat
            });
        } catch (err) {
            res.status(200).json({
                status: false,
                msg: "Kesalahan",
                response: [err.message]
            });
        }
    } else {
        res.status(200).json({
            status: false,
            msg: "Token is wrong",
            response: []
        });
    }
});


initApplication();

server.listen(port, function() {
    console.log('App running on *: ' + port)
})


// === TEST SECTION ===
app.get('/mem', async (req, res) => {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`

    const memoryData = process.memoryUsage()


    const memoryUsage = {
                    rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
                    heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
                    heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
                    external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    }

    res.status(200).json({
        status: true,
        msg: "Berhasil mendapatkan memory usage",
        response: [memoryUsage]
    })
})



