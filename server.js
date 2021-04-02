'use strict';
const bodyparser = require('body-parser');

const express = require('express');
const config = require('./config');
const FBeamer = require('./fbeamer');
const STEAM = require('./steam');

const server = express();
const PORT = process.env.PORT || 3000;

const FB = new FBeamer(config.FB);

server.get('/', (request, response) => FB.registerHook(request, response));
server.listen(PORT, () => console.log(`FBeamer Bot Service running on Port ${PORT}`));
server.post('/', bodyparser.json({ verify: FB.verifySignature.call(FB) }));
server.post('/', (request, response, data) => {
  return FB.incoming(request, response, data => {
    const userData = FB.messageHandler(data);
    console.log(userData.content.nlp.intents);
    console.log(userData.content.nlp.entities);
    STEAM(userData.content.nlp, userData.sender).then(value => {
      try {
        if(value.txt){
          if(Array.isArray(value.txt)){
            value.txt.forEach(txt => {
              FB.txt(userData.sender, txt);
            });
          } else {
            FB.txt(userData.sender, value.txt);
          }
        }
        if(value.img){
          if (Array.isArray(value.img)){
            value.img.forEach(img => {
              FB.img(userData.sender, img);
            });
          } else {
            FB.img(userData.sender, value.img);
          }
        }
      } catch(error) {}
    });
  });
});