'use strict';
require('dotenv').config()

module.exports = {
    FB: {
        ACCESS_TOKEN: process.env.ACCESS_TOKEN,
        VERIFY_TOKEN: process.env.VERIFY_TOKEN,
        APP_SECRET: process.env.APP_SECRET
    },
    TMDB: process.env.TMDB
}