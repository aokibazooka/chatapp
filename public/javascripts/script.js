$(function(){

  // socket.io 1/5
  var socket = io();

  var addMessage = function(message){

    var overMessages = $('#messages').children().length - 19;
    if(overMessages>0){
      $('#messages').children().first().remove();
    }

    // socket.io 2/5
    message.date = new Date(message.date);

    var date = message.date.toLocaleDateString()
      + ' ' + message.date.toLocaleTimeString();

    $('#messages').append('' +
      '<tr>' +
        '<td>' + message.name + '</td>' +
        '<td>' + message.text + '</td>' +
        '<td>' + date + '</td>' +
      '</tr>');

  };

  var createMessage = function(){

    var text = $('input#message').val();
    var message = {
      text: text,
      date: new Date()
    };

    $('input#message').val('');
    return message;

  };

  var updateParticipant = function(users){

    $('.users').remove();

    users.forEach(function(user){
      var li = '<li id="'+user+'" class="list-group-item users">'+user+'</li>';
      $('#participant').append(li);
    });

  };

  var denxchan = {

    jump: function(){
      $("#denxchan")
        .animate({ bottom: '20px'}, 150, 'swing')
        .animate({ bottom: '0px' }, 150, 'swing');
    },

    shake: function(){
      $("#denxchan")
        .animate({ left: '-10px' }, 60, 'swing')
        .animate({ left: '10px' }, 120, 'swing')
        .animate({ left: '0px' }, 60, 'swing');
    }

  };

  $('button#submit').click(function(){

    var message = createMessage();
    denxchan.jump();

    // socket.io 3/5
    socket.emit('messageToServer', message);

  });

  $('input#message').keypress(function(e){

    if (e.which == 13) {

      var message = createMessage();
      denxchan.jump();

      // socket.io 4/5
      socket.emit('messageToServer', message);
    }

  });

  // socket.io 5/5
  socket.on('messageToClient', function(message){
    addMessage(message);
  });

  socket.on('updateParticipant', function(users){
    updateParticipant(users)
  });

  denxchan.shake();

});
