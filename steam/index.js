'use strict';
const config = require("../config");
const axios = require('axios');

const facebook = async (id) => {
    let url = `https://graph.facebook.com/${id}?fields=first_name,last_name&access_token=${config.FB.ACCESS_TOKEN}`;
    const response = await axios(url);
    const { data, status } = response;
    if (status >= 200 && status < 300) {
        return data;
    } else {
        console.error(status);
        return false;
    }
}

const findID64 = async (input) => {
    input = input.replace(' ', '');
    if (input.includes('steamcommunity')) {
        let arr = input.split('/');
        if(arr.indexOf('id') !== -1){
            input = arr[arr.indexOf('id') + 1]
        } else {
            input = arr[arr.indexOf('profiles') + 1]
        }
    }
    console.log(input);
    if (input.length != 17 || !input.startsWith('765')) {
        let url = `http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${config.STEAM}&vanityurl=${input}`;
        const response = await axios(url);
        const { data, status } = response;
        if (status >= 200 && status < 300) {
            if (data.response.success == 1) {
                return data.response.steamid;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }
    return input;
}

const personProfile = async (id) => {
    let url = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.STEAM}&steamids=${id}`;
    const response = await axios(url);
    const { data, status } = response;
    try{
        if (status >= 200 && status < 300) {
            let player = data.response.players[0];
            let profile = {};
            profile.name = player.personaname;
            profile.id = player.steamid;
            profile.image = player.avatarfull;
            return profile;
        } else {
            console.error(status);
            return false;
        }
    } catch(error) { 
        console.error(error);
        return false; 
    }
}

const getGenres = async (ids) => {
    let url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${config.TMDB}&language=en-US`;
    const response = await axios(url);
    const { data, status } = response;
    if (status >= 200 && status < 300) {
        var genre = [];
        data.genres.forEach(g => {
            if (ids.includes(g.id)) {
                genre.push(g.name.toLowerCase());
            }
        });
        return genre;
    } else {
        console.error(status);
        return false;
    }
}

const getPerson = async (id) => {
    let url = `https://api.themoviedb.org/3/person/${id}?api_key=${config.TMDB}&language=en-US`;
    const response = await axios(url);
    const { data, status } = response;
    if (status >= 200 && status < 300) {
        //console.log(data);
        return data;
    } else {
        console.error(status);
        return false;
    }
}

const getMovieData = async (movie, releaseYear = null) => {
    let url = `https://api.themoviedb.org/3/search/movie?api_key=${config.TMDB}&language=en-US&query=${movie}&year=${releaseYear}`;
    const response = await axios(url);
    const { data, status } = response;
    if (status >= 200 && status < 300) {
        return data.results[0];
    } else {
        console.error(status);
        return false;
    }
}

const getCredits = async (movie, releaseYear = null) => {
    let data_id = await getMovieData(movie, releaseYear);
    if (data_id) {
        let id = data_id.id;
        let title = data_id.title;
        let url = `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${config.TMDB}&language=en-US`;
        const response = await axios(url);
        const { data, status } = response;
        if (status >= 200 && status < 300) {
            data['title'] = title;
            return data;
        } else {
            console.error(status);
            return false;
        }
    }
}

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
}

module.exports = (nlpData, senderID) => {
    return new Promise(async (resolve, reject) => {
        let ext = extract(nlpData);
        if (ext[0] == 'gameInfo') {
            try {
                let response = await getMovieData(movie, releaseYear);
                let genres = await getGenres(response.genre_ids);
                if (response) {
                    let text = `${response.title} is a movie from ${response.release_date.slice(0, 4)}.\n\nGenres: ${genres.join(', ')}\n\nPitch:\n${response.overview}`;
                    let image = `https://image.tmdb.org/t/p/original${response.poster_path}`;
                    resolve({
                        txt: text,
                        img: image
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
                let response = true;
                if (response) {
                    resolve({
                        txt: "Suggestion mode coming soon",
                        img: null
                    });
                }
            } catch (error) { }
        }
        else if (ext[0] == 'steam') {
            try {
                let id = await findID64(ext[1]);
                console.log(id);
                if (id){
                    let profile = await personProfile(id);
                    console.log(profile);
                    if(profile){
                        resolve({
                            txt: `${profile.name} (${profile.id})`,
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
}