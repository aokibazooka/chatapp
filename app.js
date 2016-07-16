var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
// setting socket.io 1/4
var http = require('http');
var socketio = require('socket.io');
// xss defence 1/2
var xssFilters = require('xss-filters');
// mongoDB 1/4
var mongoose = require('mongoose');
// setting passport 1/3
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var session = require('express-session');
var ensureLogin = require('connect-ensure-login');
// setting passport.socketio 1/2
var passportSocketIo = require("passport.socketio");
var MongoStore = require('connect-mongo')(session);

var app = express();
// setting socket.io 2/4
var server = http.Server(app);
var io = socketio(server);
// mongoDB 2/4
var db = mongoose.connect('mongodb://localhost/chatapp');
var MessageSchema = new mongoose.Schema({
  name: String,
  text: String,
  date: String
});
var UserSchema = new mongoose.Schema({
  username: { type:String, unique: true },
  password: String
});
var Message = mongoose.model('Message', MessageSchema);
var User = mongoose.model('User', UserSchema);
// setting passport 2/3
var sessionStore = new MongoStore({ mongooseConnection: mongoose.connection });

var nowusers = [];

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// setting socket.io 3/4
app.set('port', process.env.PORT || 4001);

app.use(favicon(path.join(__dirname, 'public', 'denx_favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// setting passport 3/3
passport.use(new Strategy(
  function (username, password, cb) {
    User.findOne({
      username: username
    }, function (err, user) {
      if (err) { return cb(err); }
      if (!user || user.password != password) { return cb(null, false); }
      var flag = false;
      nowusers.filter(user => user.username == username).forEach(()=>{
        flag = true;
      });
      if (flag) {
        return cb(null, false);
      };
      io.sockets.emit('otherlogin', user.username);
      return cb(null, user);
    });
  }));

passport.serializeUser(function (user, cb) {
  nowusers.push(user);
  cb(null, user.id);
});

passport.deserializeUser(function (id, cb) {
  User.findById(id, function (err, user) {
    cb(null, user);
  });
});

app.use(session({
  key: 'express.sid',
  secret: 'chanxden',
  saveUninitialized: true,
  store: sessionStore,
  resave: false
}));
app.use(passport.initialize());
app.use(passport.session());

// setting passport.socketio 2/2
io.use(passportSocketIo.authorize({
  passport : passport,
  cookieParser: cookieParser,
  key: 'express.sid',
  secret: 'chanxden',
  store: sessionStore
}));

// routings
app.get('/', ensureLogin.ensureLoggedIn(), (req, res)=>{
  res.render('index', { users: nowusers });
});

app.get('/login', ensureLogin.ensureLoggedOut(), (req, res)=>{
  res.render('login');
});

app.post('/login', ensureLogin.ensureLoggedOut(), passport.authenticate('local', { failureRedirect: '/login' }), (req, res)=>{
  res.redirect('/');
});

app.get('/logout', ensureLogin.ensureLoggedIn(), (req, res)=>{
  nowusers.splice(nowusers.indexOf(req.user), 1);
  io.sockets.emit('otherlogout', req.user.username);
  req.logout();
  res.redirect('/');
});

app.get('/register', ensureLogin.ensureLoggedOut(), (req, res)=>{
  res.render('register');
});

app.post('/register', ensureLogin.ensureLoggedOut(), (req, res)=>{
  User.findOne({ username: req.body.username }, (err, data)=>{
    if(data==null && req.body.username.length <= 20 && req.body.username.length >= 1 && req.body.password.length >= 1 ){
      var newuser = new User({
        username: xssFilters.inHTMLData(req.body.username),
        password: xssFilters.inHTMLData(req.body.password)
      });
      newuser.save();
    };
  });
  res.redirect('/login');
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', { message: err.message, error: err });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', { message: err.message, error: {} });
});

// using socket.io
io.on('connection', function (socket) {
  // mongoDB 3/4
  var latestMassages = Message.find({}).sort({$natural:-1}).limit(20);
  latestMassages.exec((err, messages)=>{
      messages
        .sort((a,b)=>{ if( a.date < b.date ) return -1; if( a.date > b.date ) return 1; return 0; })
        .forEach(message => socket.emit('messageToClient', message));
    });

  socket.on('messageToServer', message => {

    // XSS defence 2/2
    message.text = xssFilters.inHTMLData(message.text);
    message.name = xssFilters.inHTMLData(socket.request.user.username);

    //mongoDB 4/4
    var messagedb = new Message(message);
    messagedb.save();

    io.sockets.emit('messageToClient', message);
  });

});

// setting socket.io 4/4
server.listen(app.get('port'), function () {
  console.log('istening on port ' + app.get('port'));
});

module.exports = app;
