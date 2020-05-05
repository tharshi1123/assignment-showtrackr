// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 8080;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');
var tokenSecret = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTI1NDEyODksImlkIjoiIiwib3JpZ19pYXQiOjE1NTI0NTQ4ODksInVzZXJpZCI6NTIyNjYzLCJ1c2VybmFtZSI6InMua2lyaXNoYW50aDk3YmtkIn0.Wz5eIpRxuQDRsj3slNi3fSbrgHSrzVzSBAE3RRUPkKn1LyPVB8B0uF9dCIVVOkXL7YXXqjw_weZ_2gr89bNbA35EPcJFn7SymecR28jjk3b5d5I3aKjNXJWzsNGPYZEhVN04FOFpJQsqOgG8KcUIcyV9V99hqUOsPoY-f35nyEu34lQtcrBVReRyJVlsD3MZuNoE7t1IV_6tEHUlVnp9nlRwfQUwT8IEX3lgbVGm2sAlpza5srhw7xfvnGylkq0SnvyoWN7gi22nwjrhYxkNC_D9lvUcDwmZOaMmlUKULMMMZS8kM0i1UzlbpLlScrURIK591euNOUkJbkTJ5FjYUg';

// configuration ===============================================================
mongoose.connect('mongodb://localhost:27017/tharshijs3', {
  useMongoClient: true,
  /* other options */
});

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: 'ilovescotchscotchyscotchscotch', // session secret
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
