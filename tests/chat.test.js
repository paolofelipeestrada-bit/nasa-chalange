/* Chat da equipe: limpeza do texto (o que o anfitrião aceita e repassa). */
(function () {
  'use strict';
  var T = window.T, test = T.test, assert = T.assert;
  T.group('Chat da equipe');

  test('chat: texto limpo, sem quebras, até 140 letras; vazio não vale', function () {
    var c = MS.net.cleanChat;
    assert.equal(c('  oi   equipe \n tudo bem? '), 'oi equipe tudo bem?');
    assert.equal(c(''), null);
    assert.equal(c('   \n\t '), null);
    assert.equal(c(42), null);
    assert.equal(c(null), null);
    assert.equal(Array.from(c(new Array(300).join('🚀'))).length, 140, 'corta em 140 (emoji conta 1)');
    assert.equal(c('a\u202eb'), 'a b', 'tira caracteres que viram o texto');
  });

  test('chat: sem sala, não envia e o histórico fica vazio', function () {
    assert.equal(MS.net.chat('oi'), false);
    assert.equal(MS.net.chatLog().length, 0);
  });

  test('chat: mensagens recebidas aparecem escapadas, a gaveta só com sala', function () {
    var active = MS.net.active, info = MS.net.info, chatLog = MS.net.chatLog;
    try {
      MS.net.active = function () { return true; };
      MS.net.info = function () { return { inRoom: true, code: 'TESTE1', me: 'g1', members: [{ id: 'host', name: 'Ana', roles: [] }, { id: 'g1', name: 'Bia', roles: [] }] }; };
      MS.net.chatLog = function () { return [{ n: 1, by: 'Ana', byId: 'host', x: '<b>oi</b>', at: 0 }, { n: 2, by: 'Bia', byId: 'g1', x: 'olá', at: 0 }]; };
      MS.ui.chatAfter(MS.store.createState());
      MS.net.onChat({ n: 1, by: 'Ana', byId: 'host', x: '<b>oi</b>', at: 0 });
      var box = document.getElementById('chat');
      assert(box && !box.hidden, 'gaveta visível na sala');
      assert(!box.querySelector('.ct-log b'), 'HTML vindo da rede não vira tag');
      assert.equal(box.querySelectorAll('.ct-m.mine').length, 1, 'a minha mensagem fica do meu lado');
      assert.equal(box.querySelector('.ct-badge').hidden, false, 'conta mensagem nova com a gaveta fechada');
      MS.net.active = function () { return false; };
      MS.net.info = function () { return { inRoom: false }; };
      MS.net.chatLog = function () { return []; };
      MS.ui.chatAfter(MS.store.createState());
      assert(box.hidden, 'sem sala, sem gaveta');
    } finally { MS.net.active = active; MS.net.info = info; MS.net.chatLog = chatLog; }
  });
})();
