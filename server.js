const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const ws = require("ws");

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static('public'));

//---------------------------------------------------------------------------------------------------------------------------------------

const PORT = 443;

const options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

const server = https.createServer(options, app).listen(PORT, () => {
    console.log(`Servidor HTTPS corriendo en https://localhost:${PORT}`);
});

//---------------------------------------------------------------------------------------------------------------------------------------

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.originalUrl}`);
    next();
});

app.post('/info_twitch', (req, res) => {

    console.log('llega algo??')
    console.log(req.body);

    const messageType = req.headers['twitch-eventsub-message-type'];

    if (messageType === 'webhook_callback_verification') {
        console.log("Verificando callback...");
        return res.status(200).send(req.body.challenge);
    }

    res.sendStatus(200);
});

app.get('/info_twitch', (req, res) => {
    console.log('2222')
    console.log(req.body);

    res.sendStatus(200);
});

app.get('/', (req, res) => {
    console.log('GET', req);
    res.sendStatus(200);
});

app.post('/', (req, res) => {
    console.log('POST', req);
    res.sendStatus(200);
});

//---------------------------------------------------------------------------------------------------------------------------------------

// PÁGINA PRINCIPAL
app.get('/twitch_token', (req, res) => {
    res.sendFile('public/twitch_token.html', { root: __dirname });
});

// OBTENER EL USER_ID CON EL NOMBRE DE USUARIO
app.post("/twitch_token/user_id", async (req, res) => {

    try {
        const { token, CLIENT_ID, username } = req.body;
        const data = await verUserID(username, token, CLIENT_ID);

        res.json(data);

    } catch(e) {
        console.log(e);
        res.sendStatus(404);
    }
});

// VER SI EL USUARIO ESTÁ EN DIRECTO
app.post("/twitch_token/is_live", async (req, res) => {

    try {
        const { token, CLIENT_ID, username } = req.body;
        const data = await esUserLive(username, token, CLIENT_ID);

        console.log(data);

        res.json(data);

    } catch(e) {
        console.log(e);
        res.sendStatus(404);
    }
});

// GENERAR TOKEN
app.post("/twitch_token/generar_token", async (req, res) => {

    try {
        const { permisos, CLIENT_ID, CLIENT_SECRET } = req.body;
        const data = await generarTokenBOT(CLIENT_ID, CLIENT_SECRET, permisos);

        res.json(data);

    } catch(e) {
        console.log(e);
        res.sendStatus(404);
    }
});

// GENERAR AUTHORIZATION_CODE - PARA IRC
app.post("/twitch_token/authorization_code", async (req, res) => {

    try {
        const { CLIENT_ID, CLIENT_SECRET, CLIENT_CODE, URI_REDIRECT } = req.body;
        const data = await generarAuthorizationCode(CLIENT_ID, CLIENT_SECRET, CLIENT_CODE, URI_REDIRECT);

        res.json(data);

    } catch(e) {
        console.log(e);
        res.sendStatus(404);
    }
});

//---------------------------------------------------------------------------------------------------------------------------------------

// PÁGINA CHAT TWITCH
app.get('/twitch_chat', (req, res) => {
    res.sendFile('public/twitch_chat.html', { root: __dirname });
});

//---------------------------------------------------------------------------------------------------------------------------------------

// CHAT GENERAL
app.get('/chat_prueba', (req, res) => {
    res.sendFile('public/chat_prueba.html', { root: __dirname });
});

const wss = new ws.Server({ server });
const usuariosConectados = new Map();

wss.on('connection', (ws, req) => {

    const url = new URL(req.url, `http://${req.headers.host}`);
    const username = url.searchParams.get('username');

    // VER SI YA ESTÁ CONECTADO
    if (usuariosConectados.has(username)) {
        ws.close(1008, '¡Este usuario ya está conectado!');
        return;
    }

    console.log('Cliente conectado');

    // Enviar mensaje al cliente
    ws.send('SERVER: ¡Hola desde el servidor WebSocket!');
    usuariosConectados.set(username, ws);

    wss.clients.forEach(client => {
        if(client.readyState === ws.OPEN && client !== ws) client.send(`SERVER: ${username} se ha conectado`);
    });

    // Escuchar mensajes del cliente
    ws.on('message', (message) => {

        wss.clients.forEach(client => {
            if(client.readyState === ws.OPEN && client !== ws) client.send(`${username}: ${message}`);
        });
    });

    // CERRAR CONEXIÓN CON EL CLIENTE
    ws.on('close', () => {

        // ELIMINAR DE LA LISTA DE USUARIOS CONECTADOS
        usuariosConectados.delete(username);

        //
        wss.clients.forEach(client => {
            if(client.readyState === ws.OPEN && client !== ws) client.send(`SERVER: ${username} se ha desconectado`);
        });
    });
});

//---------------------------------------------------------------------------------------------------------------------------------------

var READ_CHAT_CONECTION = null;
const contadorTeclas = new Map();
var timeoutTeclas = null;

const { CLIENT_AUTHORIZATION } = require('./config/config.js'); 

// READ CHAT
app.get('/read_chat', (req, res) => {
    res.sendFile('public/read_chat.html', { root: __dirname });
});

// EMPEZAR A LEER
app.get('/read_chat/start', (req, res) => {

    try {
        
        const wsOptions = {
            type: 'wss',
            port: 443,
            host: 'irc-ws.chat.twitch.tv',
        };
        
        const connection = new ws.WebSocket(`${wsOptions.type}://${wsOptions.host}:${wsOptions.port}`);
        READ_CHAT_CONECTION = connection;

        const USERNAME      = 'pepe_cortez';
        const CANAL_NAME    = 'pepe_cortez';
        const TOKEN         = CLIENT_AUTHORIZATION;

        connection.on('open', () => { 
            console.log('CONEXION ABIERTA');

            const code = "oauth:" +TOKEN;

            connection.send(`PASS ${code}`);
            connection.send(`NICK ${USERNAME}`);

            connection.send(`JOIN #${CANAL_NAME}`);

            res.json({});
        });

        connection.on('message', (data) => { 

            if(contadorTeclas.size === 0 && timeoutTeclas == null) {
                timeoutTeclas = setTimeout(() => {

                    let maxClave = null;
                    let maxValor = -Infinity;

                    for(const [clave, valor] of contadorTeclas) {

                        if(valor > maxValor) {
                            maxValor = valor;
                            maxClave = clave;
                        }
                    }
                    console.log(`GANO ${maxClave}`);

                    contadorTeclas.clear();
                    timeoutTeclas = null;
                }, 2000);
            }

            const texto = data.toString();

            const mensaje = texto.indexOf(':', 5);
            const letra = texto.substring(mensaje);

            const actual = contadorTeclas.get(letra) || 0;
            contadorTeclas.set(letra, actual + 1);

        });

        connection.on('error', (error) => {
            console.error('Error en la conexión WebSocket:', error);
        });

        connection.on('close', (code, reason) => {
            console.log('Conexión cerrada');
        });

    } catch(e) {
        console.log(e);
        res.sendStatus(404);
    }
});

app.get('/read_chat/finish', (req, res) => {

    READ_CHAT_CONECTION.close();
    READ_CHAT_CONECTION = null;

    contadorTeclas.clear();

    res.json({});
});

//---------------------------------------------------------------------------------------------------------------------------------------

async function listaScopes(token) { // FUNCIONA
    
    const scopes = await fetch('https://id.twitch.tv/oauth2/validate', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return await scopes.json();
}

async function listaEventosSuscrito(token, CLIENT_ID) { // FUNCIONA

    const data = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': CLIENT_ID,
        },
    });

    return await data.json();
}

async function verUserID(userName, token, CLIENT_ID) { // FUNCIONA

    const data = await fetch(`https://api.twitch.tv/helix/users?login=${userName}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': CLIENT_ID,
        },
    });

    return await data.json();
}

async function esUserLive(userName, token, CLIENT_ID) { // FUNCIONA

    const data = await fetch(`https://api.twitch.tv/helix/streams?user_login=${userName}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': CLIENT_ID,
        },
    });

    return await data.json();
}

async function generarTokenBOT(CLIENT_ID, CLIENT_SECRET, permisos) {

    const data = await fetch("https://id.twitch.tv/oauth2/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials&scope=${permisos}`,
    });

    return await data.json();
}

async function generarAuthorizationCode(CLIENT_ID, CLIENT_SECRET, CLIENT_CODE, URI_REDIRECT) {

    const data = await fetch("https://id.twitch.tv/oauth2/token", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${CLIENT_CODE}&grant_type=authorization_code&redirect_uri=${URI_REDIRECT}`,
    });

    return await data.json();
}

/*
    FUNCIONA PERO DEBES SER MODERADOR EN EL CANAL QUE QUIERAS ENVIAR MENSAJES
*/

async function enviarMensajeTwitch(token, CLIENT_ID, canalID, mensaje) {

    const data = await fetch('https://api.twitch.tv/helix/chat/messages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': CLIENT_ID,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "broadcaster_id": canalID,
            "sender_id": PEPE_CORTEZ_ID,
            "message": mensaje
        }),
    });

    console.log(await data.json());
}

//---------------------------------------------------------------------------------------------------------------------------------------

const ILLO_JUAN_ID = "90075649";
const PEPE_CORTEZ_ID = "37937830";
const TWICH_ID = "12826"; // https://www.twitch.tv/twitch

async function setupTwitchRead(nueva) {

    /*const data = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': ID_CLIENTE,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            //type: "channel.chat.message",
            //"type": "channel.follow",
            "type": "stream.online",
            version: "1",
            condition: {
                "broadcaster_user_id": PEPE_CORTEZ_ID,
                //"user_id": TWICH_ID,
                //"moderator_user_id": TWICH_ID,
            },
            transport: {
                "method": "webhook",
                "callback": "https://90.69.33.242",
                "secret": "s3cre7s3cre7"
            }
        }),
    });

    const obj = await data.json();
    console.log(obj);

    return;*/

    //enviarMensajeTwitch(token, CLIENT_ID, PEPE_CORTEZ_ID, "Holaaaa");
    //await listaScopes(token);
}

setTimeout(() => { setupTwitchRead(false); }, 5000);