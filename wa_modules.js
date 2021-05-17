const { WAConnection, MessageType, Presence, Browsers, Mimetype  } = require('@adiwajshing/baileys')
const fs = require('fs')
const axios = require('axios')
const FileType = require('file-type')
const { exit } = require('process')
require('dotenv').config()

const SESSIONS_FILE = './session/whatsapp-sessions.json';


const createSessionsFileIfNotExists = function () {
    if (!fs.existsSync(SESSIONS_FILE)) {
        try {
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
            console.log('Sessions file created successfully.');
        } catch (err) {
            console.log('Failed to create sessions file: ', err);
        }
    }
}

const setSessionsFile = function (sessions) {
    fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
        if (err) {
            console.log(err);
        }
    });
}

const getSessionsFile = function () {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE));  
}

const createSession = async function(id, sessions){
    console.log("Init Session");
    let counter = 1;
    const SESSION_FILE_PATH = `./session/whatsapp-session-${id}.json`;
    let sessionCfg;
    if (fs.existsSync(SESSION_FILE_PATH)) {
        sessionCfg = require(SESSION_FILE_PATH);
    }

    const conn = new WAConnection() 
    conn.browserDescription = Browsers.macOS("Safari")
    conn.connectOptions = {
        maxIdleTimeMs: 60000,
        maxRetries: 3,
        phoneResponseTime: 15000,
        connectCooldownMs: 4000,
        alwaysUseTakeover: true,
        queryChatsTillReceived: true
    }
    if (fs.existsSync(SESSION_FILE_PATH)) {
        conn.loadAuthInfo(SESSION_FILE_PATH)
    }

    conn.on ('open', () => {
        console.log (`credentials updatesss!`)
        const authInfo = conn.base64EncodedAuthInfo()
        fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(authInfo, null, '\t'))
        sessions.push({
            id: id,
            client: conn
        });    
        const savedSessions = getSessionsFile();
        const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
        if(sessionIndex == false && savedSessions[sessionIndex].ready == false){
            savedSessions[sessionIndex].ready = true;
            setSessionsFile(savedSessions);
        }
        let data = {
            token: process.env.APIKEY,
            id: id,
            status: "Connected"
        }
        sendCallback(url("/api/device/getQrStatus"), data, "POST")
    })

    conn.on('qr', qr => {
        if(counter > 3){
            console.log("Session closed")
            conn.close()
            // let data = {
            //     token: process.env.APIKEY,
            //     id: id,
            //     qr: "timeout"
            // }
            // sendCallback(url("/api/qr"), data, "POST")
        }else{
            let data = {
                token: process.env.APIKEY,
                id: id,
                qr: qr
            }
            // sendCallback(url("/api/qr"), data, "POST")
            sendCallback(url("/api/device/getQR"), data, "POST")
            console.log("Attemp "+counter)
            counter += 1
        }
        //console.log(qr);
    })

    conn.on('connection-phone-change', () => {
        console.log ("ada ubah bro")
    })

    conn.on('close', (err) => {
        console.log("SESSION CLOSED")
        if (fs.existsSync(SESSION_FILE_PATH)) {
            fs.unlinkSync(SESSION_FILE_PATH, function(err) {
                if(err) return console.log(err)
                console.log('Session file deleted!')
            })
        }
        const savedSessions = getSessionsFile();
        const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
        if(savedSessions[sessionIndex].ready == true){
            savedSessions[sessionIndex].ready = false;
            setSessionsFile(savedSessions);
        }
        let data = {
            token: process.env.APIKEY,
            id: id,
            status: "Disconnected",
            qr: "Timeout"
        }
        // sendCallback(url("/api/status"), data, "POST")
        sendCallback(url("/api/device/getQrStatus"), data, "POST")
        //console.log(qr);
    })

    // conn.on('ws-close', (err) => {
    //     console.log("WS CLOSE")
    //     if (fs.existsSync(SESSION_FILE_PATH)) {
    //         fs.unlinkSync(SESSION_FILE_PATH, function(err) {
    //             if(err) return console.log(err)
    //             console.log('Session file deleted!')
    //         })
    //     }
    //     const savedSessions = getSessionsFile();
    //     const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
    //     if(sessionIndex && savedSessions[sessionIndex].ready == true){
    //         savedSessions[sessionIndex].ready = false;
    //         setSessionsFile(savedSessions);
    //     }
    //     let data = {
    //         token: process.env.APIKEY,
    //         id: id,
    //         status: "NOT CONNECTED",
    //         qr: "timeout"
    //     }
    //     sendCallback(url("/api/status"), data, "POST")
    //     //console.log(qr);
    // })

    conn.on('chat-update', async chats => {
        //NEW MESSAGE AND OUTGOING
        if(chats.hasNewMessage == true){
            let message = chats.messages.dict
            message = message[Object.keys(message)[0]]
            if(message.key.fromMe == false){
                let name = await getContactsName(conn, message.key.remoteJid)
                let media = await getMediaFromMessage(conn, chats)
                let data = {
                    token: process.env.APIKEY,
                    device_id: id,
                    message_id: message.key.id,
                    from: reverseNumberFormater(message.key.remoteJid),
                    nama: name,
                    message: message.message.conversation,
                    media: media
                }
                sendCallback(url("/api/receive"), data, "POST")
                //console.log(chats)
            }
        }
    })

    const savedSessions = getSessionsFile();
    const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

    if (sessionIndex == -1) {
        savedSessions.push({
            id: id,
            ready: false,
        });
        setSessionsFile(savedSessions);
    }

    await conn.connect() 
}

const deleteDevice = async function(id) {
    const SESSION_FILE_PATH = `./session/whatsapp-session-${id}.json`;
    let sessionCfg;
    if (fs.existsSync(SESSION_FILE_PATH)) {
        sessionCfg = require(SESSION_FILE_PATH);
    }
    
    const conn = new WAConnection() 
    conn.browserDescription = Browsers.macOS("Safari")
    if (fs.existsSync(SESSION_FILE_PATH)) {
        conn.loadAuthInfo(SESSION_FILE_PATH)
    }

    conn.on('ws-close', () => {
        if (fs.existsSync(SESSION_FILE_PATH)) {
            fs.unlinkSync(SESSION_FILE_PATH, function(err) {
                if(err) return console.log(err)
                console.log('Session file deleted!')
            })
        }
        const savedSessions = getSessionsFile();
        const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
        savedSessions.splice(sessionIndex, 1);
        setSessionsFile(savedSessions);
    })

    await conn.connect() 
}

const batteryDevice = async function (id) {
    const SESSION_FILE_PATH = `./session/whatsapp-session-${id}.json`;
    let sessionCfg;
    if (fs.existsSync(SESSION_FILE_PATH)) {
        sessionCfg = require(SESSION_FILE_PATH);
    }
    
    const conn = new WAConnection() 
    conn.browserDescription = Browsers.macOS("Safari")
    if (fs.existsSync(SESSION_FILE_PATH)) {
        conn.loadAuthInfo(SESSION_FILE_PATH)
    }

    conn.on ('CB:action,,battery', json => {
        const batteryLevelStr = json[2][0][1].value
        const batterylevel = parseInt (batteryLevelStr)
        // let data = {
        //     token: process.env.APIKEY,
        //     id: id,
        //     batteryLevel: batterylevel 
        // }
        // sendCallback(url("/api/device/getBattery"), data, "POST")
        console.log ("battery level: " + batterylevel + "%")
    })

}

const sendText = async function(session, number, msg){
    // if(session.chats.get(number)){
    //     await session.chatRead(number, "read")
    // }
    await session.updatePresence(number, Presence.composing) 
    await sleep(500);
    await session.updatePresence(number, Presence.paused) 
    await session.sendMessage (number, msg, MessageType.text)
    console.log("SUCCESS SENT TEXT TO "+number)
}

const sendMedia = async function(session, number, msg=null, file){
    let mimetype;
    const attachment = await axios.get(file, {
        responseType: 'arraybuffer'
    }).then(response => {
        mimetype = response.headers['content-type'];
        return response.data;
    });
    //console.log(mimetype);
    //await session.chatRead(number, "read")
    console.log(msg);
    if(msg){
        await session.sendMessage (number, attachment, mimeToMessageType(mimetype, MessageType), { caption: msg, mimetype: mimetype })
    }else{
        await session.sendMessage (number, attachment, mimeToMessageType(mimetype, MessageType), { mimetype: mimetype })
    }
    console.log("SUCCESS SENT MEDIA TO "+number)
}

const setTyping = async function(session, number){
    await session.updatePresence(number, Presence.composing)
}

const setOnline = async function(session, number){
    await session.updatePresence(number, Presence.available)
}

const getChatsDetail = async function(session, number){
    return await session.loadMessages(number, 25)
}

const getChats = async function(session){
    let res = await session.chats
    return res
}

const getChatsList = async function(session){
    let final = []
    let res = await session.loadChats(100).then(async chats => {
        let c = chats.chats
        for (let key in c) {
            let name
            if (c[key].name) {
                name = c[key].name
            } else {
                name = reverseNumberFormater(c[key].jid)
            }

            let last_chat

            if (c[key].messages) {
                let last_message = c[key].messages.dict
                last_message = last_message[Object.keys(last_message)[0]]
                if (last_message.message !== null) {
                    last_chat = last_message.message.conversation
                }
            }
            //let profile = await session.getProfilePicture(c[key].jid).catch(() => '')
            // if(profile){
            //     console.log(profile)
            // }

            //console.log(last_message.message)
            let data = {
                "id": {
                    "_serialized": c[key].jid
                },
                "name": name,
                "unreadCount": c[key].count,
                "timestamp": c[key].t,
                "last_chat": last_chat,
                //"profile": profile
            }
            final.push(data)
        }
    })
    // let c = res.dict
    
    return final
}

const getChatDetail = async function(session, number){
    let final = []
    let res = await session.loadMessages(number, 100).then(msg => {
        let message = msg.messages
        for(let key in message){
            let chat
            let type
            let id
            let c = message[key].message
            
            if(c){
                if(c.conversation){
                    chat = c.conversation
                    type = "chat"
                }else if(c.extendedTextMessage){
                    chat = c.extendedTextMessage.text
                    type = "chat"
                }else{
                    chat = ""
                    type = "media"
                }

                if(message[key].key.id){
                    id = message[key].key.id
                }
    
                let data = {
                    "id": {"id": id},
                    "fromMe": message[key].key.fromMe,
                    "body": chat,
                    "type": type,
                    "ack": "2",
                    "timestamp": message[key].messageTimestamp.low
                }
                final.push(data)
            }
        }
    })
    return final
}

const fakeTyping = async function(session, number){
    setTyping(session, number)
    await sleep(3000)
    //setOnline(session, number)
}

const sendCallback = function(url, data, method){
    if(method == "POST"){
        axios.post(url, data).then(res => {
            console.log("SUCCESS SEND CALLBACK TO SERVER")
            //console.log("SUCCESS", url, data)
        }).catch(error => {
            console.log("FAILED SEND CALLBACK TO SERVER")
            //console.error(error)
        })
    }
}

const getContacts = async function (session) {
    contact = await session.contacts
    let final = []
    for (let key in contact) {
        let isG = false
        if(contact[key]['jid'].endsWith("@g.us")){
            isG = true
        }
        let data = {
            "name": contact[key]["name"],
            "number": reverseNumberFormater(contact[key]["jid"]),
            "isGroup": isG
        }
        final.push(data)
    }
    return final
}

const getContactsName = async function(session, jid){
    contact = await session.contacts
    return contact[jid].name
}

const findGroupByName = async function(session, name){
    let jid
    let chats = await getChats(session).then(chat => {
        let c = chat.dict
        for(let key in c){
            if(c[key].name == name){
                //console.log(c[key].jid)
                jid = c[key].jid
            }
        }
    })
    return jid
}

const getGroups = async function(session){
    let data = []
    let chats = await getChats(session).then(chat => {
        //console.log(chat)
        let c = chat.dict
        for(let key in c){
            if(c[key].jid.endsWith("@g.us")){
                let d = {
                    id: c[key].jid,
                    name: c[key].name
                }
                data.push(d)
            }
        }
    })
    return data
}

const getGroupMetadata = async function(session, jid){
    return await session.groupMetadata(jid)
}


const checkNumber = async function(session, number){
    if(number.endsWith("@g.us")){
        return true
    }else{
        return await session.isOnWhatsApp(number)
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}   

function url(param){
    return process.env.BASEURL+param
}

function reverseNumberFormater(number){
    if (number.endsWith('@s.whatsapp.net')) {
        let n = number.split("@");
        number = n[0]

        if (number.startsWith('62')) {
            number = '0' + number.substr(2);
        }
    }
    return number
}


const getMediaFromMessage = async function(session, chats){
    const m = chats.messages.all()[0]
    const messageContent = m.message
    if (!messageContent) return
    const messageType = Object.keys (messageContent)[0]
    if (messageType === MessageType.text) {
        return ""
    } else if (messageType === MessageType.extendedText) {
        return ""
    } else if (messageType === MessageType.contact) {
        return ""
    } else if (messageType === MessageType.location || messageType === MessageType.liveLocation) {
        return ""
    } else {
        try {
            //const savedFile = await session.downloadAndSaveMediaMessage(m, './Media/media_in_' + m.key.id)
            const buffer = await session.downloadMediaMessage(m);
            let mime = await FileType.fromBuffer(buffer)
            mime = mime[Object.keys(mime)[1]]
            let data = {
                mimetype: mime,
                data: Buffer.from(buffer).toString('base64')
            }
            return data
        } catch (err) {
            console.log('error in decoding message: ' + err)
        }
    }
}

function mimeToMessageType(mime, msg_type){
    if(mime == "image/jpeg"){
        return msg_type.image
    }else if(mime == "image/png"){
        return msg_type.image
    }else if(mime == "image/jpg"){
        return msg_type.image
    }else if(mime == "video/mp4"){
        return msg_type.video
    }else{
        return msg_type.document
    }
}

module.exports = {
    createSessionsFileIfNotExists,
    setSessionsFile,
    getSessionsFile,
    deleteDevice,
    batteryDevice,
    createSession, 
    sendText, 
    sendMedia,
    setTyping,
    setOnline,
    getChatsDetail,
    getChats,
    getChatsList,
    fakeTyping,
    getContacts,
    findGroupByName,
    checkNumber,
    getGroups,
    getGroupMetadata,
    getChatDetail
}