const matchesList = document.getElementById('matches-list');
const commentaryList = document.getElementById('commentary-list');
const selectedMatchLabel = document.getElementById('selected-match-label');
const matchForm = document.getElementById('create-match-form');
const commentaryForm = document.getElementById('create-commentary-form');
const refreshBtn = document.getElementById('refresh-matches');
const toast = document.getElementById('toast');

let matches = [];
let selectedMatchId = null;
let ws;
let reconnectTimer;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle('error', isError);
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function renderMatches() {
  matchesList.innerHTML = '';

  if (matches.length === 0) {
    matchesList.innerHTML = '<li class="meta">No matches yet.</li>';
    return;
  }

  for (const match of matches) {
    const item = document.createElement('li');
    item.className = `list-item ${match.id === selectedMatchId ? 'active' : ''}`;
    item.innerHTML = `
      <p><strong>${match.homeTeam}</strong> ${match.homeScore} - ${match.awayScore} <strong>${match.awayTeam}</strong></p>
      <p class="meta">${match.sport} · ${match.status} · ${formatDate(match.startTime)}</p>
    `;
    item.addEventListener('click', () => selectMatch(match.id));
    matchesList.appendChild(item);
  }
}

function renderCommentary(comments) {
  commentaryList.innerHTML = '';

  if (!comments.length) {
    commentaryList.innerHTML = '<li class="meta">No commentary for this match.</li>';
    return;
  }

  for (const comment of comments) {
    const item = document.createElement('li');
    item.className = 'list-item';
    const actor = comment.actor ? `${comment.actor} · ` : '';
    const minute = Number.isInteger(comment.minute) ? `${comment.minute}' · ` : '';
    item.innerHTML = `
      <p>${comment.message}</p>
      <p class="meta">${minute}${actor}${comment.eventType || 'update'} · ${formatDate(comment.createdAt)}</p>
    `;
    commentaryList.appendChild(item);
  }
}

async function loadMatches() {
  const data = await fetchJson('/matches?limit=30');
  matches = data.data;
  renderMatches();
}

async function loadCommentary(matchId) {
  const data = await fetchJson(`/matches/${matchId}/commentary?limit=30`);
  renderCommentary(data.data);
}

function selectMatch(matchId) {
  selectedMatchId = matchId;
  const match = matches.find((m) => m.id === matchId);
  selectedMatchLabel.textContent = match
    ? `Selected match: ${match.homeTeam} vs ${match.awayTeam} (${match.status})`
    : 'Select a match to view commentary.';
  commentaryForm.classList.toggle('disabled', !match);
  renderMatches();

  if (matchId) {
    sendWs({ type: 'subscribe', matchId });
    loadCommentary(matchId).catch((err) => showToast(err.message, true));
  }
}

function connectWs() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.addEventListener('open', () => {
    showToast('Realtime connected');
    if (selectedMatchId) {
      sendWs({ type: 'subscribe', matchId: selectedMatchId });
    }
  });

  ws.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'match_created') {
        matches = [message.data, ...matches];
        renderMatches();
        showToast('New match created');
        return;
      }

      if (message.type === 'commentary' && message.data.matchId === selectedMatchId) {
        const existing = [...commentaryList.querySelectorAll('.list-item')].map((item) => item.textContent);
        if (!existing.some((text) => text.includes(message.data.message))) {
          loadCommentary(selectedMatchId).catch(() => {});
        }
      }
    } catch {
      // ignore malformed events
    }
  });

  ws.addEventListener('close', () => {
    showToast('Realtime disconnected. Reconnecting...', true);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWs, 1200);
  });
}

function sendWs(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

matchForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(matchForm);
  const body = {
    sport: formData.get('sport'),
    homeTeam: formData.get('homeTeam'),
    awayTeam: formData.get('awayTeam'),
    startTime: new Date(formData.get('startTime')).toISOString(),
    endTime: new Date(formData.get('endTime')).toISOString(),
    homeScore: Number(formData.get('homeScore') || 0),
    awayScore: Number(formData.get('awayScore') || 0),
  };

  try {
    await fetchJson('/matches', { method: 'POST', body: JSON.stringify(body) });
    matchForm.reset();
    showToast('Match created');
    await loadMatches();
  } catch (err) {
    showToast(err.message, true);
  }
});

commentaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedMatchId) {
    showToast('Please select a match first', true);
    return;
  }

  const formData = new FormData(commentaryForm);
  const body = {
    minute: formData.get('minute') ? Number(formData.get('minute')) : undefined,
    eventType: formData.get('eventType') || undefined,
    actor: formData.get('actor') || undefined,
    team: formData.get('team') || undefined,
    message: formData.get('message'),
  };

  try {
    await fetchJson(`/matches/${selectedMatchId}/commentary`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    commentaryForm.reset();
    showToast('Commentary posted');
    await loadCommentary(selectedMatchId);
  } catch (err) {
    showToast(err.message, true);
  }
});

refreshBtn.addEventListener('click', () => {
  loadMatches().catch((err) => showToast(err.message, true));
});

(async () => {
  try {
    await loadMatches();
    connectWs();
  } catch (err) {
    showToast(err.message, true);
  }
})();
