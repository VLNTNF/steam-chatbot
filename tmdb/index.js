'use strict';
const config = require("../config");
const axios = require('axios');

const personProfile = async (id) => {
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
        //console.log(data.results[0]);
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

const extractIntent = nlp => {
    try {
        const int = nlp.intents[0];
        const con = int.confidence;
        if (int && con >= 0.8) {
            return int.name;
        }
    } catch (error) { }
    return false;
}

const extractEntity = (nlp, entity) => {
    try {
        const ent = nlp.entities[entity][0];
        const con = ent.confidence;
        if (ent && con >= 0.8) {
            return ent.value;
        }
    } catch (error) { }
    return false;
}

module.exports = (nlpData, senderID) => {
    return new Promise(async (resolve, reject) => {
        let intent = extractIntent(nlpData);
        if (intent) {
            let movie = extractEntity(nlpData, 'movie:movie');
            if (movie) {
                let releaseYear = extractEntity(nlpData, 'releaseYear:releaseYear');
                if (intent == 'movieinfo') {
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
                        else {
                            resolve({
                                txt: "I'm struggling with the API!",
                                img: null
                            });
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
                else if (intent == 'director') {
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
                        else {
                            resolve({
                                txt: "I'm struggling with the API!",
                                img: null
                            });
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
                else if (intent == 'releaseYear') {
                    try {
                        let response = await getMovieData(movie, releaseYear);
                        if (response) {
                            let text = `${response.title} was released in ${response.release_date.slice(0, 4)}.`;
                            resolve({
                                txt: text,
                                img: null
                            });
                        }
                        else {
                            resolve({
                                txt: "I'm struggling with the API!",
                                img: null
                            });
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
                else if (intent == 'welcoming') {
                    try {
                        let response = await personProfile(senderID);
                        if (response) {
                            let text = `Hello ${response.first_name} 😀`;
                            resolve({
                                txt: text,
                                img: null
                            });
                        }
                        else {
                            resolve({
                                txt: "I'm struggling with the API!",
                                img: null
                            });
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
                else {
                    resolve({
                        txt: "My dev messed me up!",
                        img: null
                    });
                }
            } else {
                resolve({
                    txt: "I'm not sure I understand you!",
                    img: null
                });
            }
        } else {
            resolve({
                txt: "I'm not sure I understand you!",
                img: null
            });
        }
    });
}