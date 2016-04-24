/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express  = require('express'),
  app        = express(),
  fs         = require('fs'),
  path       = require('path'),
  bluemix    = require('./config/bluemix'),
  extend     = require('util')._extend,
  watson     = require('watson-developer-cloud'),
  Cloudant   = require('cloudant'),
  _          = require('underscore');

// Load env vars from the local .env file
// (We use this for Cloudant credentials)
require('dotenv').load();

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
// (We've hardcoded credentials for this particular app here)
var credentials =  extend({
  url: "https://gateway.watsonplatform.net/dialog/api",
  username: "1f63dfb5-5988-46d9-a414-0cd3529e4eb4",
  password: "TwZXJR6GmQ1r",
  version: 'v1'
}, bluemix.getServiceCreds('dialog')); // VCAP_SERVICES


var dialog_id_in_json = (function() {
  try {
    var dialogsFile = path.join(path.dirname(__filename), 'dialogs', 'dialog-id.json');
    var obj = JSON.parse(fs.readFileSync(dialogsFile));
    return obj[Object.keys(obj)[0]].id;
  } catch (e) {
  }
})();

// In production we get the dialog ID from an env var.
// Locally we use the dialog ID that we stored in the local JSON file.
var dialog_id = process.env.DIALOG_ID || dialog_id_in_json || '<missing-dialog-id>';

// Create the service wrapper
var dialog = watson.dialog(credentials);

// Set up Cloudant persistence
var cloudant = Cloudant(process.env.cloudant_url);

// Print available Cloudant DBs on boot as a sanity check
cloudant.db.list(function(err, allDbs) {
  console.log('All my databases: %s', allDbs.join(', '))
});

var chatSessions = cloudant.db.use('chat_sessions');

app.get('/test', function (req, res) {
  res.send('GET request to the test page');
});

app.post('/conversation', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.conversation(params, function(err, results) {
    if (err) {
      return next(err);
    }
    else {
      // No error, update the db with the latest conversation state.
      // This all happens async, we can respond to the user before
      // we actually save to the db.

      dialog.getProfile(params, function(err, profile) {
        if (err) {
        } else {
          // This comes back in the format:
          //
          // { name_values:
          //    [ { name: 'Diary', value: 'it was great!' },
          //      { name: 'FeelsPain', value: 'No' } ] }
          var profileVars = profile.name_values;

          var conversationId = String(results.conversation_id);

          chatSessions.get(conversationId, { revs_info: true },
            function (err, body) {
              // We set the primary key on the chatSession database
              // record to be the Watson conversation ID, so that any
              // further updates will happen in-place to the existing
              // conversation record.
              var chatSession = {
                _id: conversationId,
              };

              // IF we got an existing chat session from the db,
              // use its rev to facilitate updating in place.
              // (If not we can just ignore that)
              if (!_.isUndefined(body)) {
                chatSession["_rev"] = body["_rev"];
              }

              _.each(profileVars, function (profileVar) {
                chatSession[profileVar.name] = profileVar.value;
              });

              console.log(chatSession);

              // Insert the chat session into the database.
              // Note that if we already have a record for this session
              // we will update it in place because it's keyed by
              // Watson conversation ID
              chatSessions.insert(chatSession, function(err, body) {
                if (!err)
                  console.log(body);
                else
                  console.log(err);
              })
            }
          );
        }
      });

      res.json({ dialog_id: dialog_id, conversation: results});
    }
  });
});

app.post('/profile', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.getProfile(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json(results);
  });
});

// @author: Kodai Ito
// add another page
app.get('/detail', function (req, res) {
  console.log(req);
  fs.readFile(__dirname+"/public/detail.html", "utf-8", function(err, data){
    if(err){
      res.send(err);
    }
    else{
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(data);
      res.end()
    }
  });
});

app.get('/john', function (req, res) {
  console.log(req);
  fs.readFile(__dirname+"/public/john.html", "utf-8", function(err, data){
    if(err){
      res.send(err);
    }
    else{
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(data);
      res.end()
    }
  });
});

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);

