/* =====================================================================
 * net/room.js — SALA MULTIPLAYER (PeerJS, conexão direta entre navegadores)
 *
 * Modelo: o ANFITRIÃO (quem cria a sala) guarda o state oficial.
 *   - Convidado clica → pede a ação ao anfitrião ({ t: 'action' }).
 *   - Anfitrião confere a permissão (MS.team.can), aplica no MS.store e
 *     manda o state novo para todos ({ t: 'state' }).
 *   - Convidado substitui o seu state pelo recebido (MS.store.load).
 * Mesma semente para todos = mesmos imprevistos para a equipe inteira.
 *
 *   MS.net.host(nome) · join(código, nome) · leave() · claimRoles([ids])
 *   MS.net.dispatch(ação, args)   usado pela interface no lugar do store
 *   MS.net.active() · info()      para as telas
 *   MS.net.onUpdate               chamado quando sala/membros/status mudam
 * ===================================================================== */
(function (root) {
  'use strict';
  var MS = root.MS, team = MS.team;
  var t = MS.i18n.t;
  var PREFIX = 'nasa-chalange-sim-';
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var JOIN_TIMEOUT_MS = 15000;
  var R = null;     // sessão atual da sala (null = jogando sozinho)
  var lastError = '';

  var net = MS.net = { onUpdate: null, onToast: null };

  function notify() { if (net.onUpdate) net.onUpdate(); }
  function toast(msg) { if (net.onToast) net.onToast(msg); }
  function scenario() { return MS.data.scenarios[MS.store.state.scenarioId]; }
  function maxPlayers() { var t = scenario().team; return (t && t.maxPlayers) || 4; }
  function newCode() {
    var c = '';
    for (var i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }
  function errorText(err) {
    var map = {
      'peer-unavailable': 'net.err.notFound', 'network': 'net.err.network', 'server-error': 'net.err.server',
      'browser-incompatible': 'net.err.browser', 'unavailable-id': 'net.err.inUse'
    };
    var key = map[err && err.type];
    return key ? t(key) : t('net.err.other', { e: err && (err.type || err.message) || '?' });
  }
  function fail(msg) {
    lastError = msg;
    var wasGuest = R && !R.isHost;
    if (R && R.peer) { try { R.peer.destroy(); } catch (e) { /* já fechado */ } }
    R = null;
    if (wasGuest) backToSolo();
    notify();
  }
  function backToSolo() {
    MS.store.setPersistence(true);
    MS.store.init({ render: MS.ui.render }); // volta ao jogo solo salvo
  }

  // -------------------------------------------------------------- Anfitrião
  function host(name) {
    if (!root.Peer) return fail(t('net.noPeer'));
    if (R) leave();
    lastError = '';
    var code = newCode(), myName = team.cleanName(name);
    var peer = new root.Peer(PREFIX + code);
    R = {
      isHost: true, code: code, me: 'host', myName: myName, peer: peer, conns: {}, status: 'connecting',
      members: [{ id: 'host', name: myName, roles: [], host: true }]
    };
    peer.on('open', function () { if (R && R.peer === peer) { R.status = 'online'; notify(); } });
    peer.on('connection', function (conn) {
      conn.on('data', function (msg) { onHostMessage(conn, msg); });
      conn.on('close', function () { removeMember(conn.peer); });
      conn.on('error', function () { removeMember(conn.peer); });
    });
    peer.on('disconnected', function () { if (R && R.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('error', function (err) {
      if (err.type === 'peer-unavailable') return; // convidado sumiu: ignorar
      if (err.type === 'unavailable-id') { R = null; return host(myName); } // código repetido: sorteia outro
      fail(errorText(err));
    });
    notify();
  }

  function send(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { /* conexão caiu */ } }
  function broadcast(msg) { Object.keys(R.conns).forEach(function (id) { send(R.conns[id], msg); }); }
  function broadcastRoom() { broadcast({ t: 'room', code: R.code, members: R.members }); notify(); }
  function nameOf(id) { var m = team.member(R.members, id); return m ? m.name : t('net.someone'); }

  function onHostMessage(conn, msg) {
    if (!R || !R.isHost || !msg || typeof msg !== 'object') return;
    var id = conn.peer;
    if (msg.t === 'hello') {
      if (R.conns[id]) return;
      if (R.members.length >= maxPlayers()) { send(conn, { t: 'full' }); setTimeout(function () { conn.close(); }, 500); return; }
      R.conns[id] = conn;
      R.members.push({ id: id, name: team.cleanName(msg.name), roles: [] });
      send(conn, { t: 'welcome', you: id });
      send(conn, { t: 'state', state: MS.store.state });
      broadcastRoom();
      toast(t('net.joined', { name: nameOf(id) }));
      return;
    }
    if (!R.conns[id]) return; // não se apresentou
    if (msg.t === 'roles') { applyRoles(id, msg.roles); return; }
    if (msg.t === 'action') applyAction(id, msg.name, msg.args);
  }

  function applyRoles(id, roleIds) {
    var r = team.claim(scenario(), R.members, id, Array.isArray(roleIds) ? roleIds : []);
    if (!r.ok) { deny(id, r.reason); return; }
    R.members = r.members;
    broadcastRoom();
  }

  function deny(id, reason) {
    if (id === 'host') toast(reason);
    else send(R.conns[id], { t: 'denied', reason: reason });
  }

  function applyAction(id, name, args) {
    args = Array.isArray(args) ? args : [];
    var chk = team.can(scenario(), R.members, id, name, args);
    if (!chk.ok) { deny(id, chk.reason); return; }
    R.pending = { by: nameOf(id), byId: id, action: name, args: args, what: team.describe(scenario(), name, args) };
    try {
      var changed = MS.store[name].apply(null, args);
      if (changed === false) deny(id, t('net.notYet'));
    } catch (e) { deny(id, e.message); }
    R.pending = null;
  }

  function removeMember(id) {
    if (!R || !R.isHost || !R.conns[id]) return;
    var who = nameOf(id);
    delete R.conns[id];
    R.members = R.members.filter(function (m) { return m.id !== id; });
    broadcastRoom();
    toast(t('net.left', { name: who }));
  }

  // A cada mudança no anfitrião, a sala recebe o state novo.
  MS.store.onChange(function (state) {
    if (!R || !R.isHost) return;
    var p = R.pending;
    broadcast({ t: 'state', state: state, by: p ? p.by : R.myName, byId: p ? p.byId : 'host', what: p ? p.what : null,
      action: p ? p.action : null, args: p ? p.args : null });
    if (p && p.byId !== 'host') toast(p.by + ' ' + p.what + '.');
  });

  // -------------------------------------------------------------- Convidado
  function join(code, name) {
    if (!root.Peer) return fail(t('net.noPeer'));
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return fail(t('net.codeLen'));
    if (R) leave();
    lastError = '';
    var myName = team.cleanName(name);
    var peer = new root.Peer();
    R = { isHost: false, code: code, me: null, myName: myName, peer: peer, conn: null, status: 'connecting', members: [] };
    var session = R;
    var timer = setTimeout(function () { if (R === session && R.status !== 'online') fail(t('net.cantJoin', { code: code })); }, JOIN_TIMEOUT_MS);
    peer.on('open', function () {
      if (R !== session) return;
      var conn = peer.connect(PREFIX + code, { reliable: true });
      R.conn = conn;
      conn.on('open', function () { send(conn, { t: 'hello', name: myName }); });
      conn.on('data', function (msg) { if (R === session) onGuestMessage(msg, timer); });
      conn.on('close', function () { if (R === session) fail(t('net.hostLeft')); });
    });
    peer.on('error', function (err) { if (R === session) fail(errorText(err)); });
    notify();
  }

  function onGuestMessage(msg, timer) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'welcome') {
      clearTimeout(timer);
      R.me = msg.you; R.status = 'online';
      MS.store.setPersistence(false); // não sobrescreve o jogo solo salvo
      notify();
    } else if (msg.t === 'room') {
      R.members = Array.isArray(msg.members) ? msg.members : [];
      notify();
    } else if (msg.t === 'state') {
      MS.store.load(msg.state);
      if (msg.what && msg.byId !== R.me) {
        // Descreve no idioma de quem recebe (o anfitrião pode usar outro idioma).
        var what = msg.action ? team.describe(scenario(), msg.action, msg.args || []) : msg.what;
        toast(msg.by + ' ' + what + '.');
      }
    } else if (msg.t === 'denied') {
      toast(msg.reason);
    } else if (msg.t === 'full') {
      clearTimeout(timer);
      fail(t('net.full'));
    }
  }

  // ------------------------------------------------------------ Para todos
  function leave() {
    if (!R) return;
    var wasGuest = !R.isHost;
    try { R.peer.destroy(); } catch (e) { /* já fechado */ }
    R = null;
    lastError = '';
    if (wasGuest) backToSolo();
    notify();
  }

  function claimRoles(roleIds) {
    if (!R || R.status !== 'online') return;
    if (R.isHost) applyRoles('host', roleIds);
    else send(R.conn, { t: 'roles', roles: roleIds });
  }

  // A interface chama isto no lugar de MS.store[ação] quando há sala.
  function dispatch(name, args) {
    args = args || [];
    if (!R || R.status !== 'online') return MS.store[name].apply(null, args);
    if (R.isHost) return applyAction('host', name, args);
    var chk = team.can(scenario(), R.members, R.me, name, args); // resposta imediata
    if (!chk.ok) { toast(chk.reason); return; }
    send(R.conn, { t: 'action', name: name, args: args });
  }

  net.host = host;
  net.join = join;
  net.leave = leave;
  net.claimRoles = claimRoles;
  net.dispatch = dispatch;
  net.available = function () { return !!root.Peer; };
  net.active = function () { return !!(R && R.status === 'online'); };
  net.info = function () {
    if (!R) return { inRoom: false, error: lastError };
    return {
      inRoom: true, isHost: R.isHost, code: R.code, me: R.me, myName: R.myName,
      status: R.status, members: R.members, error: lastError
    };
  };
})(globalThis);
