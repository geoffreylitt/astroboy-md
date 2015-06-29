/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';

$(document).ready(function() {

  // jQuery variables attached to DOM elements
  var $error = $('.error'),
    $errorMsg = $('.errorMsg'),
    $loading = $('.loading'),
    $inputBox = $('.input-box'),
    $converseText = $('.converse-text'),
    $startOver = $('.start-over');

  // conversation variables
  var conversation_id, client_id;

  $('.converse-text').keyup(function(event){
    if(event.keyCode === 13) {
      converse($converseText.val());
      scrollChatToBottom();
    }
  });

  /**
   * Add text to the conversation box in the UI
   * @param  origin The originator of the text
   * @param  text   The text to show
   */
  var talk = function(origin, text) {
    var $chatBox = $('.chat-box--item_' + origin).clone().first();
    $chatBox.find('p').html($('<p/>').html(text).text());
    $('.chat-box').append($chatBox);
  };

  /**
   * Creates or talk into a conversation using the dialog service
   * @param  userText The text writen by the user
   */
  var converse = function(userText){
    $loading.show();
    $error.hide();
    $inputBox.hide();

    // check if the user typed text or not
    if (typeof(userText) !== undefined && $.trim(userText) !== '')
      talk('you', userText);

    // build the conversation parameters
    var params = { input : userText };

    // check if there is a conversation in place and continue that
    // by specifing the conversation_id and client_id
    if (conversation_id) {
      params.conversation_id = conversation_id;
      params.client_id = client_id;
    }

    $.post('/conversation', params)
      .done(function onSucess(dialog){
        $converseText.val(''); // clear the text input


        // update conversation variables
        conversation_id = dialog.conversation_id;
        client_id = dialog.client_id;

        var texts = dialog.response;
        var response = texts.join('&lt;br/&gt;'); // &lt;br/&gt; is <br/>

        // did the conversation finish?
        if (texts[0].match('^Okay.')) {
          $startOver.show();
        } else {
          $inputBox.show();
          $('.converse-text')[0].focus();
        }

        talk('watson', response); // show
      })
      .fail(function onError(error) {
        $error.show();
        $errorMsg.text(error.responseJSON.error);
      })
      .always(function always(){
        $loading.hide();
        scrollChatToBottom();
        $converseText.focus();
      });
  };

  // Initialize the conversation
  converse();

  // scrolls chat box all the way to bottom
  var scrollChatToBottom = function() {
    var chatbox = $('.chat-box');
    chatbox.animate({
      scrollTop: chatbox[0].scrollHeight
    }, 420);
    $('body, html').animate({ scrollTop: $('body').height() + 'px' });
  };

  var setConversationHeight = function (){
    var maxHeight = window.innerHeight > $('body').height() ? window.innerHeight : $('body').height();
   $('.conversation-container').height(maxHeight - $('.service-header')[0].clientHeight - $('.header-container')[0].clientHeight - $('.question-bar').height() - 23);
  };

  if (window.innerHeight < $('body').height()) {
    $('body, html').animate({ scrollTop: $('body').height() + 'px' });
  }

  setConversationHeight();
  $(window).resize(function(){
    setConversationHeight();
  });
});
