'use strict';
const config = require("./config");
const axios = require('axios');


const add_ice = () => {
   // curl -X POST -H "Content-Type: application/json" -d '{}'
   axios.post(`https://graph.facebook.com/v9.0/me/messenger_profile?access_token=${config.FB.ACCESS_TOKEN}`,
      {
         "ice_breakers": [
            {
               "question": "Tell me more about Shrek 2",
               "payload": "Tell me more about Shrek 2"
            },
            {
               "question": "When was Shrek 2 released?",
               "payload": "When was Shrek 2 released?"
            },
            {
               "question": "Who directed Shrek from 2004?",
               "payload": "Who directed Shrek from 2004?"
            }
         ]
      }
   ).then(response => {
      let { data, status } = response;
      console.log(`${status}: ${data.result}`);
   }).catch(error => {
      console.log(error);
   });
}

const show_ice = () => {
   axios.get(`https://graph.facebook.com/v9.0/me/messenger_profile?fields=ice_breakers&access_token=${config.FB.ACCESS_TOKEN}`
   ).then(response => {
      let { data, status } = response;
      console.log(data.data[0].ice_breakers);
   }).catch(error => {
      console.log(error);
   });
}

const delete_ice = () => {
   axios.delete(`https://graph.facebook.com/v9.0/me/messenger_profile?fields=ice_breakers&access_token=${config.FB.ACCESS_TOKEN}`,
      {
         "fields": [
            "ice_breakers"
         ]
      }
   ).then(response => {
      let { data, status } = response;
      console.log(`${status}: ${data.result}`)
   }).catch(error => {
      console.log(error);
   });
}

show_ice();