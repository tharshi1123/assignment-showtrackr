
const MongoClient    = require('mongodb').MongoClient;
const mongoose = require('mongoose');
const https = require('https');
const request = require('request');
var show = require('./models/show');
const axios = require('axios');
axios.defaults.headers.common = {'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTI4ODkyMzEsImlkIjoidGVzdCIsIm9yaWdfaWF0IjoxNTUyODAyODMxLCJ1c2VyaWQiOjUyMzA0NCwidXNlcm5hbWUiOiJzcmlyYW1yYW0xOTk1OXV3In0.OJc2NoDqME6i3PLhY8Kx8VydT0gyihNVJzyZ1x2LbgJjwdXbPNRWy0x0rir5RfHMilbnKwXVoElDGd0rQNBxs5dNoKoiZ6Fu9npjx_8jI21qvkrKD_10qJ7ODmcjYUbERd9scEmpvQiJiwpdSLrghREldLssj9Z1Dk_IXfw-7B9vHI7R9Z-sd8iQwzn0rEmpVWySR8oyAJZlvo3eCwCURR7VwTjLN8w9Ue-D8msMONThERZzMIlr5aw5R_kGc1dwj8N_4ot4nZlU7W9tn1NKGhrgP3nTFKVJzgIb3XcxVfkM9TALOZjRLZkR5OKHQAV4AGJnMAnRke3rXv58zD6HaA'};


module.exports = function (app, passport) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function (req, res) {
        res.render('index.ejs', {user: req.user});
    });

    app.get('/add', function (req, res) {
        res.render('add.ejs', {user: req.user});
    });

    app.get('/showtrackr', function (req, res) {
        res.render('showtrackr.ejs', {user: req.user});
    });


    // PROFILE SECTION =========================
        app.get('/profile', isLoggedIn, function (req, res) {
            res.render('profile.ejs', {
                user: req.user
            });
        });


    // LOGOUT ==============================
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/getEpisode/:id', function (req, res) {
        let id = req.params.id;

      // sever is sending request to tvdb server
        axios.get('https://api.thetvdb.com/episodes/'+id)
            .then(response => {
            //response form tvdb.
              let data = response.data;

                //sending data back to our client
                res.send(JSON.stringify(data));
            })
            .catch(error => {

              let err = error;
              //sendin errors to our client
              res.send(JSON.stringify(err))
                console.log(error);
            });
    });

// ============================================================tvdb===============================================================

    app.get('/api/shows', function (req, res, next) {
        var query = Show.find();
        if (req.query.genre) {
            query.where({genre: req.query.genre});
        } else if (req.query.alphabet) {
            query.where({name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i')});
        } else {
            query.limit(12);
        }
        query.exec(function (err, shows) {
            if (err) return next(err);
            res.send(shows);
        });
    });



    app.get('/api/shows/:id', function (req, res, next) {
        Show.findById(req.params.id, function (err, show) {
            if (err) return next(err);
            res.send(show);
        });
    });



    app.post('/api/shows', function (req, res, next) {
        var seriesName = req.body.showName
            .toLowerCase()
            .replace(/ /g, '_')
            .replace(/[^\w-]+/g, '');
        var apiKey = '246b09c36e7bd783869d077acbff2353	';
        var parser = xml2js.Parser({
            explicitArray: false,
            normalizeTags: true
        });

        async.waterfall([
            function (callback) {
                request.get('http://thetvdb.com/api/GetSeries.php?seriesname=' + seriesName, function (error, response, body) {
                    if (error) return next(error);
                    parser.parseString(body, function (err, result) {
                        if (!result.data.series) {
                            return res.send(400, {message: req.body.showName + ' was not found.'});
                        }
                        var seriesId = result.data.series.seriesid || result.data.series[0].seriesid;
                        callback(err, seriesId);
                    });
                });
            },
            function (seriesId, callback) {
                request.get('http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml', function (error, response, body) {
                    if (error) return next(error);
                    parser.parseString(body, function (err, result) {
                        var series = result.data.series;
                        var episodes = result.data.episode;
                        var show = new Show({
                            _id: series.id,
                            name: series.seriesname,
                            airsDayOfWeek: series.airs_dayofweek,
                            airsTime: series.airs_time,
                            firstAired: series.firstaired,
                            genre: series.genre.split('|').filter(Boolean),
                            network: series.network,
                            overview: series.overview,
                            rating: series.rating,
                            ratingCount: series.ratingcount,
                            runtime: series.runtime,
                            status: series.status,
                            poster: series.poster,
                            episodes: []
                        });
                        _.each(episodes, function (episode) {
                            show.episodes.push({
                                season: episode.seasonnumber,
                                episodeNumber: episode.episodenumber,
                                episodeName: episode.episodename,
                                firstAired: episode.firstaired,
                                overview: episode.overview
                            });
                        });
                        callback(err, show);
                    });
                });
            },
            function (show, callback) {
                var url = 'http://thetvdb.com/banners/' + show.poster;
                request({url: url, encoding: null}, function (error, response, body) {
                    show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
                    callback(error, show);
                });
            }
        ], function (err, show) {
            if (err) return next(err);
            show.save(function (err) {
                if (err) {
                    if (err.code == 11000) {
                        return res.send(409, {message: show.name + ' already exists.'});
                    }
                    return next(err);
                }
                var alertDate = Sugar.Date.create('Next ' + show.airsDayOfWeek + ' at ' + show.airsTime).rewind({hour: 2});
                agenda.schedule(alertDate, 'send email alert', show.name).repeatEvery('1 week');
                res.send(200);
            });
        });
    });

// =======================================================================tvdbend=======================================================================================


// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function (req, res) {
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/', // redirect to the secure profile section
        failureRedirect: '/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form
    app.get('/signup', function (req, res) {
        res.render('signup.ejs', {message: req.flash('signupMessage')});
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/', // redirect to the secure profile section
        failureRedirect: '/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['public_profile', 'email']}));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect: '/profile',
            failureRedirect: '/'
        }));

    // twitter --------------------------------

    // send to twitter to do the authentication
    app.get('/auth/twitter', passport.authenticate('twitter', {scope: 'email'}));

    // handle the callback after twitter has authenticated the user
    app.get('/auth/twitter/callback',
        passport.authenticate('twitter', {
            successRedirect: '/profile',
            failureRedirect: '/'
        }));


    // google ---------------------------------

    // send to google to do the authentication
    app.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email']}));

    // the callback after google has authenticated the user
    app.get('/auth/google/callback',
        passport.authenticate('google', {
            successRedirect: '/',
            failureRedirect: '/'
        }));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
    app.get('/login', function (req, res) {
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });
    app.post('/login', passport.authenticate('local-signup', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/connect/local', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // facebook -------------------------------

    // send to facebook to do the authentication
    app.get('/connect/facebook', passport.authorize('facebook', {scope: ['public_profile', 'email']}));

    // handle the callback after facebook has authorized the user
    app.get('/connect/facebook/callback',
        passport.authorize('facebook', {
            successRedirect: '/profile',
            failureRedirect: '/'
        }));

    // twitter --------------------------------

    // send to twitter to do the authentication
    app.get('/connect/twitter', passport.authorize('twitter', {scope: 'email'}));

    // handle the callback after twitter has authorized the user
    app.get('/connect/twitter/callback',
        passport.authorize('twitter', {
            successRedirect: '/profile',
            failureRedirect: '/'
        }));


    // google ---------------------------------

    // send to google to do the authentication
    app.get('/connect/google', passport.authorize('google', {scope: ['profile', 'email']}));

    // the callback after google has authorized the user
    app.get('/connect/google/callback',
        passport.authorize('google', {
            successRedirect: '/profile',
            failureRedirect: '/'
        }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function (req, res) {
        var user = req.user;
        user.local.email = undefined;
        user.local.password = undefined;
        user.save(function (err) {
            res.redirect('/profile');
        });
    });

    // facebook -------------------------------
    app.get('/unlink/facebook', isLoggedIn, function (req, res) {
        var user = req.user;
        user.facebook.token = undefined;
        user.save(function (err) {
            res.redirect('/profile');
        });
    });

    // twitter --------------------------------
    app.get('/unlink/twitter', isLoggedIn, function (req, res) {
        var user = req.user;
        user.twitter.token = undefined;
        user.save(function (err) {
            res.redirect('/profile');
        });
    });

    // google ---------------------------------
    app.get('/unlink/google', isLoggedIn, function (req, res) {
        var user = req.user;
        user.google.token = undefined;
        user.save(function (err) {
            res.redirect('/profile');
        });
    });

    // add tv show
    app.post('/addShow', function (req, res) {


        var newShow = new show();
        newShow.showName = req.body.show;
        newShow.save(function (err, newShow) {
            if (err) {
                res.redirect('/add');
            } else {
                res.redirect('/add');
                console.log("Document Save Done");
                console.log(newShow);

            }
        });


    });

};


// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}
