'use strict';
const crypto = require('crypto');
const axios = require('axios');
const apiVersion = 'v10.0';

class FBeamer {
    constructor({ ACCESS_TOKEN, VERIFY_TOKEN, APP_SECRET }) {
        try {
            if (ACCESS_TOKEN && VERIFY_TOKEN && APP_SECRET) {
                this.ACCESS_TOKEN = ACCESS_TOKEN;
                this.VERIFY_TOKEN = VERIFY_TOKEN;
                this.APP_SECRET = APP_SECRET;
            } else {
                throw "One or more tokens/credentials are missing!";
            }
        } catch (error) {
            console.log(error);
        }
    }

    registerHook(req, res) {
        const params = req.query;
        const mode = params['hub.mode'],
            token = params['hub.verify_token'],
            challenge = params['hub.challenge'];
        try {
            if (mode === "subscribe" & token === this.VERIFY_TOKEN) {
                console.log("Webhook is registered")
                return res.send(challenge);
            } else {
                console.log("Could not register webhook!");
                return res.sendStatus(400);
            }
        } catch (error) {
            console.log(error);
        }
    }

    verifySignature(req, res, buf) {
        return (req, res, buf) => {
            if (req.method === 'POST') {
                try {
                    const signature = req.headers['x-hub-signature'].substr(5);
                    const hash = crypto.createHmac('sha1', this.APP_SECRET).update(buf, 'utf-8').digest('hex');
                    if (signature !== hash)
                        throw 'Error verifying x hub signature';
                }
                catch (error) {
                    console.log(error);
                }
            }
        }
    }

    incoming(req, res, callback) {
        res.sendStatus(200);
        if (req.body.object === 'page' && req.body.entry) {
            const data = req.body;
            const messageObj = data.entry;
            if (!messageObj[0].messaging)
                console.log("Error message");
            else {
                return callback(messageObj[0].messaging);
            }
        }
    }

    messageHandler(obj) {
        const sender = obj[0].sender.id;
        const message = obj[0].message;
        const obj2 = {
            sender,
            type: 'text',
            content: message
        }
        return obj2;
    }

    sendMessage(payload) {
        return new Promise((resolve, reject) => {
            axios({
                method: 'post',
                url: `https://graph.facebook.com/${apiVersion}/me/messages?access_token=${this.ACCESS_TOKEN}`,
                headers: { 'Content-Type': 'application/json' },
                data: payload
            }, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve({
                        messageId: body.message_id
                    });
                } else {
                    reject(error);
                }
            });
        });
    }

    txt(id, text, messaging_type = 'RESPONSE') {
        let obj = {
            messaging_type,
            recipient: {
                id
            },
            message: {
                text
            }
        }
        return this.sendMessage(obj);
    }

    img(id, url, messaging_type = 'RESPONSE') {
        let obj = {
            messaging_type,
            recipient: {
                id
            },
            message: {
                attachment: {
                    type: 'image',
                    payload: {
                        url
                    }
                }
            }
        }
        return this.sendMessage(obj);
    }
}

module.exports = FBeamer;