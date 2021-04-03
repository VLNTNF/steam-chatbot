'use strict';
const config = require("../config");
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'data.json');

/**
 * Utility
 */
const unixToDate = (unix) => {
    var a = new Date(unix * 1000);
    var months = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    var time = {};
    time.year = a.getFullYear();
    time.month = months[a.getMonth()];
    time.day = a.getDate();
    time.hour = a.getHours();
    time.min = a.getMinutes();
    time.sec = a.getSeconds();
    return time;
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const sortDict = (dict, key) => {
    var array = []
    for (var id in dict) {
        let e = dict[id];
        e.id = id;
        array.push(e);
    }
    array.sort((a, b) => {
        return b[key] - a[key];
    });
    return array;
};

const maxArray = (arr, key) => {
    var max = arr[0][key];
    arr.forEach(x => {
        if(x[key] > max){
            max = x[key]
        }
    });
    return max;
};

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
            if (player.communityvisibilitystate >= 3) {
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

const personFriends = async (id) => {
    let url = `http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${config.STEAM}&steamid=${id}&relationship=friend`;
    const data = await fetch(url);
    if (data) {
        try {
            var list = [];
            let friends = data.friendslist.friends;
            if (friends.length > 0) {
                friends.forEach(f => {
                    list.push(f.steamid);
                });
                return list;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const ownedGames = async (id) => {
    let url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${config.STEAM}&steamid=${id}&include_appinfo=true&format=json`;
    const data = await fetch(url);
    if (data.response) {
        try {
            var res = [];
            let games = data.response.games;
            if (games && games.length > 0) {
                games.forEach(x => {
                    if (x.playtime_forever > 60) {
                        let game = {};
                        game.id = x.appid;
                        game.name = x.name;
                        game.time = x.playtime_forever;
                        res.push(game);
                    }
                });
                if (res.length > 0) {
                    return res;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const likedGenres = async (id) => {
    let games = await ownedGames(id);
    if (games) {
        try {
            var info = {};
            for (let game of games) {
                if (game.time > 0) {
                    let x = await gameInfo(game.id);
                    if (x && x.genres.length > 0) {
                        x.genres.forEach(genre => {
                            info[genre] = (info[genre] || { count: 0, time: 0 });
                            info[genre].count += 1;
                            info[genre].time += game.time;
                        });
                    }
                }
            }
            for (var g in info){
                let genre = info[g];
                genre.avg = parseFloat((genre.time/genre.count).toFixed(2));
            }
            return info;
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const friendGames = async (id) => {
    let friendList = await personFriends(id);
    if (friendList) {
        try {
            var info = {};
            for (let friend of friendList) {
                let games = await ownedGames(friend);
                if (games) {
                    games.forEach(x => {
                        info[x.id] = (info[x.id] || { count: 0, name: x.name, time: 0 });
                        info[x.id].count += 1;
                        info[x.id].time += x.time;
                    });
                }
            }
            for (var id in info){
                let game = info[id];
                game.avg = parseFloat((game.time/game.count).toFixed(2));
            }
            return info;
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const gamesAttractivity = async (id) => {
    var games = await friendGames(id);
    if (games) {
        try {
            var sortedGames = sortDict(games, "avg");
            sortedGames = sortedGames.slice(0, 10);
            var maxgame = maxArray(sortedGames, "avg");
            sortedGames.forEach(x => {
                x.normal = x.avg/maxgame;
            });
            for (var game of sortedGames) {
                let info = await gameInfo(game.id);
                let genres = [];
                if (info && info.genres.length > 0) {
                    genres = info.genres;
                }
                game.genres = genres;
            }
            console.log(sortedGames);
            var liked = await likedGenres(id);
            if(liked){
                var sortedGenres = sortDict(liked, "avg");
                var maxgenre = maxArray(sortedGenres, "avg");
                sortedGenres.forEach(x => {
                    x.normal = x.avg/maxgenre;
                });
                console.log(sortedGenres);
                return(sortedGames.slice(0,3));
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
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
    const d = await fetch(url);
    let info = {};
    if (d) {
        try {
            const data = d[`${id}`].data;
            if (data) {
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
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
};

const gameNews = async (id) => {
    let url = `http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${id}&count=3&maxlength=50&format=json`;
    const d = await fetch(url);
    if (d) {
        try {
            if (d.appnews.count > 0) {
                var newsArray = [];
                d.appnews.newsitems.forEach(data => {
                    let news = {};
                    news.author = data.feedlabel;
                    news.title = data.title;
                    news.link = data.url.replace(' ', '');
                    news.date = data.date;
                    let date = unixToDate(data.date);
                    news.dateString = `${date.month} ${date.day}, ${date.year}`;
                    newsArray.push(news);
                });
                return newsArray;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return false;
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
                let appID = await searchGame(ext[1]);
                if (appID) {
                    let appNews = await gameNews(appID);
                    if (appNews) {
                        var texts = [];
                        appNews.forEach(news => {
                            let text = [`News from ${news.author} (${news.dateString})`];
                            text.push(`${news.title}`);
                            text.push(`${news.link}`);
                            texts.push(text.join('\n\n'));
                        });
                        resolve({
                            txt: texts,
                            img: null
                        });
                    } else {
                        resolve({
                            txt: "No news for this game 😮",
                            img: null
                        });
                    }
                } else {
                    resolve({
                        txt: "Game not found 😕",
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
                        if (profile.private) {
                            resolve({
                                txt: "Your account is private!\nSwitch to public to use features 😄",
                                img: null
                            });
                        } else {
                            var games = await gamesAttractivity(id);
                            if (games) {
                                var texts = [];
                                games.forEach(g => {
                                    texts.push(`${g.name}\n\nGenres: ${g.genres.join(', ')}`)
                                })
                                resolve({
                                    txt: texts,
                                    img: null
                                });
                            }
                        }
                    } else {
                        resolve({
                            txt: ["I don't know your steam account 😅", 'Add it by answering: My steam is _(your link/ID64/username)_'],
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
                        if (profile.private) {
                            text.push('Your account is private!\nSwitch to public to use features 😄')
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
                    let text = [`Hello *${response.first_name}* 👋🏻`];
                    text.push('Ask me what you want:\ntell me...\n- games to play\n- news about _(a game)_\n- more about _(another game)_')
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

module.exports.sleep = (ms) => {
    return sleep(ms);
};