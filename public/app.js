const socket = io();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let playerId = localStorage.getItem('emberfall-player-id') || makeId();
let playerName = localStorage.getItem('emberfall-player-name') || '';
let roomCode = '';
let session = null;
let actionDraft = '';
let toastTimeout;
let isQueueing = false;
let restoringRoom = false;
localStorage.setItem('emberfall-player-id', playerId);

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3300);
}

function switchScreen(screenId) {
  $('#homeScreen').classList.toggle('hidden', screenId !== 'homeScreen');
  $('#gameScreen').classList.toggle('hidden', screenId !== 'gameScreen');
}

function openEntry(tab = 'create') {
  $('#entryModal').classList.remove('hidden');
  $('#queueModal').classList.add('hidden');
  $('#playerNameInput').value = playerName;
  setEntryTab(tab);
  setTimeout(() => (tab === 'join' ? $('#roomCodeInput') : $('#playerNameInput')).focus(), 40);
}

function closeEntry() {
  $('#entryModal').classList.add('hidden');
}

function setEntryTab(tab) {
  $$('.entry-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  $('#createTab').classList.toggle('hidden', tab !== 'create');
  $('#joinTab').classList.toggle('hidden', tab !== 'join');
  $('#entryTitle').textContent = tab === 'join' ? 'Join your companions' : 'Gather your companions';
}

function getPlayerName() {
  const value = $('#playerNameInput').value.trim().replace(/[<>]/g, '').slice(0, 24);
  if (!value) {
    showToast('Enter a player name to continue.');
    $('#playerNameInput').focus();
    return null;
  }
  playerName = value;
  localStorage.setItem('emberfall-player-name', playerName);
  return playerName;
}

function showSession(snapshot) {
  session = snapshot;
  roomCode = snapshot.code;
  playerId = snapshot.myPlayerId || playerId;
  localStorage.setItem('emberfall-player-id', playerId);
  localStorage.setItem('emberfall-last-room', roomCode);
  if (playerName) localStorage.setItem('emberfall-player-name', playerName);
  $('#entryModal').classList.add('hidden');
  $('#queueModal').classList.add('hidden');
  switchScreen('gameScreen');
  renderSession();
}

function createNode(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function currentPlayer() {
  return session?.players.find((player) => player.id === session.myPlayerId) || null;
}

function isHost() {
  return Boolean(session && session.hostPlayerId === session.myPlayerId);
}

function renderSession() {
  if (!session) return;
  $('#roomCodeLabel').textContent = session.code;
  $('#inviteCodeLarge').textContent = session.code;
  $('#lobbySetting').textContent = session.settingLabel;
  $('#lobbyDifficulty').textContent = session.difficultyLabel;
  $('#activeSetting').textContent = session.settingLabel;
  $('#activeDifficulty').textContent = session.difficultyLabel;
  $('#dmModeLabel').textContent = session.aiEnabled ? 'AI DUNGEON MASTER ONLINE' : 'DEMO DUNGEON MASTER';
  $('#connectionStatus').textContent = socket.connected ? 'CONNECTED' : 'RECONNECTING';

  $('#lobbyView').classList.toggle('hidden', session.status !== 'lobby');
  $('#draftView').classList.toggle('hidden', session.status !== 'draft');
  $('#adventureView').classList.toggle('hidden', session.status !== 'active');

  if (session.status === 'lobby') renderLobby();
  if (session.status === 'draft') renderDraft();
  if (session.status === 'active') renderAdventure();
}

function renderLobby() {
  const count = session.players.length;
  $('#gameTitle').textContent = 'The Gathering';
  $('#playerCount').textContent = `${count} / 5`;
  const playerList = $('#lobbyPlayers');
  playerList.replaceChildren();

  session.players.forEach((player, index) => {
    const row = createNode('div', 'player-row');
    row.append(createNode('div', 'player-avatar', index === 0 ? '♛' : '⚔'));
    const main = createNode('div', 'player-row-main');
    main.append(createNode('strong', '', player.name));
    main.append(createNode('small', '', player.id === session.hostPlayerId ? 'PARTY HOST' : 'ADVENTURER'));
    row.append(main);
    row.append(createNode('span', `player-state${player.online ? '' : ' offline'}`, player.online ? 'ONLINE' : 'OFFLINE'));
    playerList.append(row);
  });

  const startButton = $('#startDraftButton');
  startButton.disabled = !isHost() || count < 2;
  $('#hostHint').textContent = !isHost()
    ? 'The party host will begin the character draft.'
    : count < 2
      ? 'Invite at least one more player to begin.'
      : 'Your party is ready. Begin the character draft when everyone is set.';
}

function renderDraft() {
  $('#gameTitle').textContent = 'The Character Draft';
  const chosen = session.players.filter((player) => player.character).length;
  $('#draftProgress').textContent = `${chosen} / ${session.players.length} CHOSEN`;
  const me = currentPlayer();
  const pool = $('#characterPool');
  pool.replaceChildren();

  session.characterOptions.forEach((option) => {
    const taken = Boolean(option.takenBy);
    const owner = session.players.find((player) => player.id === option.takenBy);
    const card = createNode('article', `character-card${taken ? ' taken' : ''}`);
    if (taken) card.append(createNode('span', 'card-taken-label', `TAKEN · ${owner?.name || 'PLAYER'}`));
    card.append(createNode('div', 'card-icon', option.icon));
    card.append(createNode('h3', '', option.name));
    card.append(createNode('div', 'role', option.className + ' · ' + option.role));
    card.append(createNode('p', '', option.description));
    const stats = createNode('div', 'card-stats');
    stats.append(createNode('span', '', `♥ ${option.hp} HP`));
    stats.append(createNode('span', '', `✦ ${option.moves.length} techniques`));
    card.append(stats);
    const button = createNode('button', 'btn btn-outline', taken ? 'UNAVAILABLE' : 'CHOOSE THIS HERO');
    button.disabled = taken || Boolean(me?.character);
    button.addEventListener('click', () => socket.emit('choose-character', { playerId: session.myPlayerId, optionId: option.id }));
    card.append(button);
    pool.append(card);
  });

  const classSelect = $('#customClass');
  if (classSelect.options.length !== session.classOptions.length) {
    classSelect.replaceChildren();
    session.classOptions.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} — ${item.role}`;
      classSelect.append(option);
    });
  }
  const hasCharacter = Boolean(me?.character);
  $('#customName').disabled = hasCharacter;
  $('#customClass').disabled = hasCharacter;
  $('#createCustomButton').disabled = hasCharacter;
  $$('.character-card button').forEach((button) => { button.disabled = button.disabled || hasCharacter; });
  $('#draftWaiting').classList.toggle('hidden', !hasCharacter);
  if (hasCharacter) $('#draftWaiting').textContent = `You have chosen ${me.character.name}. Waiting for the rest of the party...`;
}

function renderAdventure() {
  $('#gameTitle').textContent = 'The Dungeon Master';
  const me = currentPlayer();
  if (!me?.character) return;
  const character = me.character;
  $('#storyHeading').textContent = `The ${session.settingLabel} Chronicle`;
  $('#roundNumber').textContent = String(Math.max(1, session.round));
  $('#myCharacterIcon').textContent = character.icon || '⚔️';
  $('#myCharacterName').textContent = character.name;
  $('#myCharacterClass').textContent = character.className.toUpperCase();
  $('#myCharacterDescription').textContent = character.description;
  $('#hpText').textContent = `${character.hp} / ${character.maxHp}`;
  $('#hpMeter').style.width = `${Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100))}%`;
  $('#movesText').textContent = `${character.movesLeft} / ${character.maxMoves}`;
  $('#movesList').replaceChildren();
  character.moves.forEach((move) => $('#movesList').append(createNode('div', 'ability-chip', move)));
  $('#ultimateName').textContent = character.ultimateName;
  $('#ultimateState').textContent = character.ultimateCooldown > 0 ? `RECHARGING · ${character.ultimateCooldown} ROUND${character.ultimateCooldown === 1 ? '' : 'S'}` : 'READY';
  $('#ultimateGlyph').textContent = character.ultimateCooldown > 0 ? '◌' : '✧';
  $('#levelText').textContent = String(character.level || 1);
  $('#characterCondition').textContent = character.hp <= 0 ? 'DOWN — NEEDS AID' : character.hp < character.maxHp * .3 ? 'WOUNDED' : 'READY FOR THE UNKNOWN';

  const playerStatus = $('#partyStatusBar');
  playerStatus.replaceChildren();
  session.players.forEach((player) => {
    const chip = createNode('div', `status-chip${player.hasSubmitted ? ' done' : ''}`);
    chip.append(createNode('span', 'mini-dot'));
    chip.append(document.createTextNode(`${player.name}: ${player.hasSubmitted ? 'SEALED' : 'THINKING'}`));
    playerStatus.append(chip);
  });

  const storyFeed = $('#storyFeed');
  const isNearBottom = storyFeed.scrollHeight - storyFeed.scrollTop - storyFeed.clientHeight < 90;
  storyFeed.replaceChildren();
  let lastRound = null;
  session.story.forEach((entry) => {
    if (entry.round && entry.round !== lastRound) {
      lastRound = entry.round;
      storyFeed.append(createNode('div', 'story-round-label', `— ROUND ${entry.round} —`));
    }
    storyFeed.append(createNode('p', `story-entry ${entry.type || 'story'}`, entry.text));
  });
  if (isNearBottom || storyFeed.scrollHeight === 0) storyFeed.scrollTop = storyFeed.scrollHeight;

  const adventurePlayers = $('#adventurePlayers');
  adventurePlayers.replaceChildren();
  session.players.forEach((player) => {
    const row = createNode('div', 'adventure-player');
    const icon = createNode('div', 'adventure-player-icon', player.character?.icon || '⚔️');
    const info = createNode('div', 'adventure-player-info');
    info.append(createNode('strong', '', player.name));
    info.append(createNode('small', '', player.character?.className || 'Adventurer'));
    if (player.character) {
      const meter = createNode('div', 'hp-mini');
      const fill = createNode('span');
      fill.style.width = `${Math.max(0, Math.min(100, (player.character.hp / player.character.maxHp) * 100))}%`;
      meter.append(fill);
      info.append(meter);
    }
    row.append(icon, info);
    adventurePlayers.append(row);
  });

  const submitted = Boolean(me.hasSubmitted);
  const resolving = Boolean(session.resolving);
  $('#actionInput').value = actionDraft;
  $('#actionInput').disabled = submitted || resolving;
  $('#submitActionButton').disabled = submitted || resolving;
  $('#waitingMessage').classList.toggle('hidden', !submitted && !resolving);
  $('#waitingMessage').textContent = resolving
    ? 'The Dungeon Master is weaving every action into the next scene...'
    : `Your action is sealed. Waiting for ${Math.max(0, session.players.length - session.pendingCount)} player(s) to submit.`;
  $('#submissionHint').textContent = submitted ? 'ACTION SEALED' : 'Only you can see what you write.';
  $('#submitActionButton').textContent = submitted ? 'ACTION SUBMITTED' : 'SUBMIT ACTION  ✦';
  $('#actionCounter').textContent = `${actionDraft.length} / 500`;
}

function copyText(value, successMessage) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(() => showToast(successMessage)).catch(() => fallbackCopy(value, successMessage));
  } else {
    fallbackCopy(value, successMessage);
  }
}

function fallbackCopy(value, successMessage) {
  const temp = document.createElement('textarea');
  temp.value = value;
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.append(temp);
  temp.select();
  try {
    document.execCommand('copy');
    showToast(successMessage);
  } catch {
    showToast('Copy failed. You can copy this manually: ' + value);
  }
  temp.remove();
}

function getInviteLink() {
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
}

$('#startButton').addEventListener('click', () => openEntry('create'));
$('#joinButton').addEventListener('click', () => openEntry('join'));
$('#randomButton').addEventListener('click', () => openEntry('create'));
$('#closeEntryButton').addEventListener('click', closeEntry);
$('#entryModal').addEventListener('click', (event) => { if (event.target === $('#entryModal')) closeEntry(); });
$$('.entry-tab').forEach((button) => button.addEventListener('click', () => setEntryTab(button.dataset.tab)));

$('#createRoomButton').addEventListener('click', () => {
  const name = getPlayerName();
  if (!name) return;
  socket.emit('create-room', {
    playerId,
    name,
    setting: $('#settingSelect').value,
    difficulty: $('#difficultySelect').value
  });
});

$('#joinRoomButton').addEventListener('click', () => {
  const name = getPlayerName();
  if (!name) return;
  const code = $('#roomCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length !== 5) {
    showToast('Enter the five-character room code.');
    $('#roomCodeInput').focus();
    return;
  }
  socket.emit('join-room', { playerId, name, code });
});

$('#roomCodeInput').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('#playerNameInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#createRoomButton').click(); });
$('#startDraftButton').addEventListener('click', () => socket.emit('start-draft', { playerId: session?.myPlayerId }));
$('#createCustomButton').addEventListener('click', () => {
  const name = $('#customName').value.trim();
  socket.emit('create-custom-character', {
    playerId: session?.myPlayerId,
    characterName: name,
    classId: $('#customClass').value
  });
});
$('#actionInput').addEventListener('input', (event) => {
  actionDraft = event.target.value.slice(0, 500);
  $('#actionCounter').textContent = `${actionDraft.length} / 500`;
});
$('#actionInput').addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#submitActionButton').click();
});
$('#submitActionButton').addEventListener('click', () => {
  if (!actionDraft.trim()) {
    showToast('Describe your action before submitting.');
    $('#actionInput').focus();
    return;
  }
  socket.emit('submit-action', { playerId: session?.myPlayerId, action: actionDraft });
});
$('#copyInviteButton').addEventListener('click', () => copyText(getInviteLink(), 'Invite link copied.'));
$('#copyLinkButton').addEventListener('click', () => copyText(getInviteLink(), 'Invite link copied.'));
$('#copyCodeButton').addEventListener('click', () => copyText(roomCode, 'Room code copied.'));
$('#leaveButton').addEventListener('click', () => {
  if (session) socket.emit('leave-room', { playerId: session.myPlayerId });
  session = null;
  roomCode = '';
  actionDraft = '';
  localStorage.removeItem('emberfall-last-room');
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url.pathname);
  switchScreen('homeScreen');
  showToast('You left the party.');
});

$('#findRandomButton').addEventListener('click', () => {
  const name = getPlayerName();
  if (!name) return;
  isQueueing = true;
  $('#entryModal').classList.add('hidden');
  $('#queueModal').classList.remove('hidden');
  $('#queueMessage').textContent = 'Your name has been sent to the matchmaking queue. Keep this window open.';
  socket.emit('queue-random', { playerId, name });
});
$('#cancelQueueButton').addEventListener('click', () => {
  socket.emit('cancel-queue', { playerId });
  isQueueing = false;
  $('#queueModal').classList.add('hidden');
  showToast('Matchmaking cancelled.');
});

socket.on('session-state', (snapshot) => {
  showSession(snapshot);
  if (restoringRoom) {
    restoringRoom = false;
    showToast('Reconnected to your party.');
  }
});
socket.on('room-created', ({ code }) => {
  roomCode = code;
  localStorage.setItem('emberfall-last-room', code);
});
socket.on('room-joined', ({ reconnect }) => {
  if (reconnect) showToast('You are back in the party.');
});
socket.on('action-accepted', () => {
  actionDraft = '';
  $('#actionInput').value = '';
  $('#actionCounter').textContent = '0 / 500';
});
socket.on('game-error', ({ message }) => {
  showToast(message || 'Something went wrong.');
  if (restoringRoom) {
    restoringRoom = false;
    localStorage.removeItem('emberfall-last-room');
    switchScreen('homeScreen');
  }
  if (isQueueing && /not enough|queue/i.test(message || '')) {
    isQueueing = false;
    $('#queueModal').classList.add('hidden');
  }
});
socket.on('queue-status', ({ waiting }) => {
  if (isQueueing) $('#queueMessage').textContent = `You are in the queue. ${waiting} player${waiting === 1 ? '' : 's'} currently searching. Waiting for at least one companion...`;
});
socket.on('match-found', ({ code }) => {
  isQueueing = false;
  roomCode = code;
  $('#queueModal').classList.add('hidden');
  showToast('A party has been found. Welcome, adventurer.');
});
socket.on('connect', () => {
  $('#connectionStatus').textContent = 'CONNECTED';
  const savedRoom = localStorage.getItem('emberfall-last-room');
  const savedName = localStorage.getItem('emberfall-player-name');
  const inviteRoom = new URLSearchParams(window.location.search).get('room');
  const roomToRejoin = session?.code || savedRoom;
  if (!inviteRoom && roomToRejoin && savedName && !restoringRoom) {
    restoringRoom = true;
    playerName = savedName;
    socket.emit('join-room', { playerId, name: playerName, code: roomToRejoin });
  }
});
socket.on('disconnect', () => {
  $('#connectionStatus').textContent = 'RECONNECTING';
});

// Invite links can open the join tab automatically. A previous room is rejoined
// by the connect handler above when this browser has a saved player session.
const inviteCode = new URLSearchParams(window.location.search).get('room');
if (inviteCode) {
  $('#roomCodeInput').value = inviteCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  setTimeout(() => openEntry('join'), 150);
} else if (!localStorage.getItem('emberfall-last-room')) {
  switchScreen('homeScreen');
}
