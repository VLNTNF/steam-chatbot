'use strict';
const config = require("../config");
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'data.json');

/**
 * Fetch
 */
const fetch = async (url) => {
    const response = await axios(url);
    const { data, status } = response;
    if (status >= 200 && status < 300) {
        return data;
    } else {
        console.error(status);
        return false;
    }
};

/**
 * Facebook profile
 */
const facebook = async (id) => {
    let url = `https://graph.facebook.com/${id}?fields=first_name,last_name&access_token=${config.FB.ACCESS_TOKEN}`;
    const data = await fetch(url);
    return data;
};

/**
 * Steam profile
 */
const personProfile = async (id) => {
    let url = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.STEAM}&steamids=${id}`;
    const data = await fetch(url);
    if (data) {
        try {
            let player = data.response.players[0];
            let profile = {};
            profile.name = player.personaname;
            profile.id = player.steamid;
            profile.image = player.avatarfull;
            if(player.communityvisibilitystate >= 3){
                profile.private = false;
            } else {
                profile.private = true;
            }
            return profile;
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

/**
 * ID64
 */
const readID64 = () => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data.toString());
    } catch (error) {
        console.error(error);
        return false;
    }
};

const writeID64 = (ID64, senderID) => {
    try {
        var data = readID64();
        if (data) {
            data[senderID] = ID64;
            data = JSON.stringify(data, null, 4);
            fs.writeFileSync(filePath, data);
            console.log("JSON data is saved");
        } else {
            console.log("JSON read error");
        }
    } catch (error) {
        console.error(error);
    }
};

const findID64 = async (input) => {
    input = input.replace(' ', '');
    if (input.includes('steamcommunity')) {
        let arr = input.split('/');
        if (arr.indexOf('id') !== -1) {
            input = arr[arr.indexOf('id') + 1]
        } else {
            input = arr[arr.indexOf('profiles') + 1]
        }
    }
    console.log(input);
    if (input.length != 17 || !input.startsWith('765')) {
        let url = `http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${config.STEAM}&vanityurl=${input}`;
        const data = await fetch(url);
        if (data) {
            if (data.response.success == 1) {
                return data.response.steamid;
            }
        }
        return false;
    }
    return input;
};

/**
 * Game info
 */
const searchGame = async (n) => {
    let url = 'http://api.steampowered.com/ISteamApps/GetAppList/v0002/';
    const data = await fetch(url);
    if (data) {
        try {
            n = n.replace(/[^A-Z0-9]/ig, "").toLowerCase();
            console.log(n);
            let appsinfo = data.applist.apps;
            // async/await can't work with Array.find()
            let test = false, app = null;
            for (let x of appsinfo) {
                let s = x.name;
                s = s.replace(/[^A-Z0-9]/ig, "").toLowerCase();
                if (x.appid && s.includes(n)) {
                    // && !s.includes('serv') && !s.includes('sdk') && !s.includes('beta') && !s.includes('vers')
                    test = await fetch(`https://store.steampowered.com/api/appdetails?appids=${x.appid}&l=english`);
                    console.log(`${x.appid} : ${test}`);
                    if (test[`${x.appid}`].success && test[`${x.appid}`].data.type == "game") {
                        app = x;
                        break;
                    }
                }
            }
            if (app) {
                console.log(app);
                return app.appid;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const gameInfo = async (id) => {
    let url = `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`;
    console.log(url);
    const d = await fetch(url);
    let info = {};
    if (d) {
        try {
            const data = d[`${id}`].data;
            info.name = data.name;
            info.desc = data.short_description;
            info.img = data.header_image;
            info.meta = (data.metacritic) ? data.metacritic.score : null;
            info.date = (data.release_date) ? data.release_date.date : null;
            info.genres = [];
            if (data.genres) {
                data.genres.forEach(x => {
                    info.genres.push(x.description);
                });
            }
            return info;
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

/**
 * Games list
 */
const ownedGames = async (id) => {
    let url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${config.STEAM}&steamid=${id}&include_appinfo=true&format=json`;
    const data = await fetch(url);
    var res = [];
    if (data.response) {
        try {
            let games = data.response.games;
            games.forEach(x => {
                if (x.playtime_forever > 60) {
                    let game = {};
                    game.id = x.appid;
                    game.name = x.name;
                    game.time = x.playtime_forever;
                    res.push(game);
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
    return res;
};

/**
 * NLP
 */
const extract = nlp => {
    var res_int = false;
    var res_ent = false;
    try {
        const int = nlp.intents[0];
        const ent = nlp.entities[Object.keys(nlp.entities)[0]][0];
        const con_int = int.confidence;
        const con_ent = ent.confidence;
        if (int && con_int >= 0.7) {
            res_int = int.name;
        }
        if (ent && con_ent >= 0.7) {
            res_ent = ent.value;
        }

    } catch (error) { }
    console.log(res_int);
    console.log(res_ent);
    return [res_int, res_ent];
};

module.exports = (nlpData, senderID) => {
    return new Promise(async (resolve, reject) => {
        let ext = extract(nlpData);
        if (ext[0] == 'gameInfo') {
            try {
                let appID = await searchGame(ext[1]);
                if (appID) {
                    let appInfo = await gameInfo(appID);
                    if (appInfo) {
                        let text = [`${appInfo.name} is a game`];
                        if (appInfo.date) { text[0] += ` from ${appInfo.date}.`; }
                        if (appInfo.genres) { text.push(`Genres: ${appInfo.genres.join(', ')}`); }
                        if (appInfo.desc) { text.push(`Description:\n${appInfo.desc}`); }
                        if (appInfo.meta) { text.push(`Metacritic score: ${appInfo.meta}`); }
                        let image = `${appInfo.img}`;
                        resolve({
                            txt: text.join('\n\n'),
                            img: image
                        });
                    }
                } else {
                    resolve({
                        txt: "Game not found!",
                        img: null
                    });
                }
            } catch (error) { }
        }
        else if (ext[0] == 'news') {
            try {
                let response = await getCredits(movie, releaseYear);
                var directors = [];
                response.crew.forEach(entry => {
                    if (entry.job == 'Director') {
                        directors.push(entry.name);
                    }
                });
                if (response) {
                    let text = `${response['title']} has been directed by ${directors.join(', ')}.`;
                    resolve({
                        txt: text,
                        img: null
                    });
                }
            } catch (error) { }
        }
        else if (ext[0] == 'suggest') {
            try {
                let json = readID64();
                if (json) {
                    let id = json[senderID];
                    if (id) {
                        let profile = await personProfile(id);
                        if(profile.private){
                            resolve({
                                txt: "Your account is private!\nSwitch to public to use features",
                                img: null
                            });
                        } else {
                            resolve({
                                txt: "Suggestion mode coming soon",
                                img: null
                            });
                        }
                    } else {
                        resolve({
                            txt: 'Add your steam account by answering "My steam:" + your link/ID64/username',
                            img: null
                        });
                    }
                }
            } catch (error) { console.error(error); }
        }
        else if (ext[0] == 'steam') {
            try {
                let id = await findID64(ext[1]);
                console.log(id);
                if (id) {
                    writeID64(id, senderID);
                    let profile = await personProfile(id);
                    console.log(profile);
                    if (profile) {
                        let text = [`${profile.name} (${profile.id})`]
                        if(profile.private){
                            text.push('Your account is private!\nSwitch to public to use features')
                        }
                        resolve({
                            txt: text,
                            img: profile.image
                        });
                    }
                }
                resolve({
                    txt: 'Account not found!',
                    img: null
                });
            } catch (error) { console.error(error); }
        }
        else if (ext[0] == 'welcoming') {
            try {
                let response = await facebook(senderID);
                if (response) {
                    let text = `Hello ${response.first_name} 😀`;
                    resolve({
                        txt: text,
                        img: null
                    });
                }
            } catch (error) { }
        }
        else {
            resolve({
                txt: "I'm not sure I understand you!",
                img: null
            });
        }
        resolve({
            txt: "I'm struggling with the API!\nTry again later...",
            img: null
        });
    });
};