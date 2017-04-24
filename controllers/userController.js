const jwt = require('jsonwebtoken');
const chalk = require('chalk');
const config = require('../config/secret.json');
const bcrypt = require('bcrypt');
const _ = require('lodash');
const sequelize = require('../config/db');
const helpers = require('../middleware/helpers.js');

module.exports = {
  createUser: function (req, res) {
    bcrypt.hash(req.body.password, 10)
    .then (function (hash) { return hash; })
    .then((hash) => {
      req.body.password = hash;
      return sequelize.User.findOne({where: {username: req.body.username}});
    })
      .then(function (user) {
        if (user) {
          res.status(409).send({message: 'User already exists'});
          return;
        } else {
          sequelize.User.create(req.body)
          .then(function (data) {
            var userId = data.dataValues.id;
            var tokenData = jwt.sign(_.omit(data, 'password'), config.secret);
            console.log('token: ', tokenData);
            res.status(201).json({id_token: tokenData});
            return userId;
          })
          .then(function (userId) {
            sequelize.Playlist.create({name: 'Bookmarks', 'UserId': userId});
            sequelize.Playlist.create({name: 'Listening To', 'UserId': userId});
          })
          .catch((error) => {
            console.warn('Error: ', error);
          });
        }
      });
  },

  checkUser: function (req, res) {
    sequelize.User.find({where: {username: req.body.username}})
    .then(function (data) {
      if (!data) {
        res.status(400).send({message: 'Incorrect username and/or password'});
        return;
      } else {
        bcrypt.compare(req.body.password, data.password, function (err, response) {
          if(err || !response) {
            console.log('Error ', err);
            res.status(400).send({message: 'Incorrect username and/or password'});
          } else {
            var tokenData = jwt.sign(_.omit(data, 'password'), config.secret);
            console.log('token: ', tokenData);
            res.status(201).json({id_token: tokenData});
          }
        });
      }
    })
    .catch((error) => {
      console.warn('Error: ', error);
    });
  },

  likeEpisode: function (req, res) {
    console.log('LikeEpisode ran! ', req.body);
    sequelize.UserEpisode.find({where: {UserId: req.user.id, EpisodeId: req.body.id}})
      .then((record) => {
        if (record) {
          record.update({
            liked: req.body.liked
          })
          .then(function () {
            res.send(201);
          });
        } else {
          res.status(400).send({message: 'User not found'});
        }
      });
  },


  bookmarkEpisode: function (req, res) {
    //var userEpRecord = null;
    console.log('BookmarkEpisode ran!', req.body, ' USER:', req.user.id);
    sequelize.UserEpisode.find({where: {UserId: req.user.id, EpisodeId: req.body.id}})
      .then((record) => {
        if (record) {
          record.update({
            bookmarked: req.body.bookmark
          })
          .then(function () {
            res.send(201);
          })
          .then(() => {
            sequelize.Playlist.find({where: {UserId: req.user.id, name: 'Bookmarks'}})
            .then((record) => {
              console.log('Playlist record: ', record, 'req.body.id', req.body.id);
              if (req.body.bookmark) {
                sequelize.PlaylistEpisode.create({PlaylistId: record.id, EpisodeId: req.body.id});
              } else {
                sequelize.PlaylistEpisode.destroy({PlaylistId: record.id, EpisodeId: req.body.id});
              }
            });
          });
        } else {
          res.status(400).send({message: 'User not found'});
          return;
        }
      });
  },

  getInbox: function (req, res) {
    var user = req.user || helpers.mockUser();
    console.log(chalk.white('User: ', JSON.stringify(user)));
    if (config.log) {
      console.log(chalk.blue('Getting Inbox for ' + user.username + '...'));
    }
    var query = 'SELECT * FROM "Inbox" WHERE "username" = ' +  String('\'') + user.username + String('\'') + ' ORDER BY "releaseDate" DESC';

    sequelize.db.query(query)
    .then(function (data) {
      var inbox = _.chain(data[0]).keyBy('EpisodeId');
      inbox.replace(/\"([^(\")"]+)\":/g,'$1:');
      if (config.debug) {
        console.log(chalk.blue.bold('Testing Format of Inbox Object......'));
        console.log(chalk.white(inbox));
      }
      res.status(201).send(inbox);
    });
  }
};
