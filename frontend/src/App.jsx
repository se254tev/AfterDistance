import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { copyInvitationText, getInvitationLink, getWhatsAppShareUrl } from './invitations.js';
import { clearStoredSession, getStoredSession, saveStoredSession } from './session.js';

const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
  || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const DEFAULT_GAME_CONFIG = {
  experience: 'classic',
  mode: 'classic',
  category: 'classic',
  pack: 'mixed',
  language: 'english',
  timerSeconds: 0
};

function choiceLabel(choice, players = []) {
  if (choice === 'PLAYER_1') return players[0]?.nickname || 'Player 1';
  if (choice === 'PLAYER_2') return players[1]?.nickname || 'Player 2';
  return choice;
}

function GameSetup({ options, config, onChange }) {
  const experiences = options?.experiences || [];
  const modes = (options?.modes || []).filter(mode => mode.id !== 'classic');
  const compatibleCategories = options?.categoryCompatibility?.[`${config.mode}:${config.pack}`] || [];
  const compatiblePacks = options?.packCompatibility?.[`${config.mode}:${config.category}`] || [];
  const categories = (options?.categories || []).filter(category =>
    compatibleCategories.includes(category.id)
  );
  const packs = (options?.packs || []).filter(pack => compatiblePacks.includes(pack.id));
  function updateWithCompatibleSettings(nextConfig) {
    let category = nextConfig.category;
    let pack = nextConfig.pack;
    let compatible = options?.categoryCompatibility?.[`${nextConfig.mode}:${pack}`] || [];
    if (!compatible.includes(category)) category = 'mixed';
    const availablePacks = options?.packCompatibility?.[`${nextConfig.mode}:${category}`] || [];
    if (!availablePacks.includes(pack)) pack = availablePacks[0] || pack;
    compatible = options?.categoryCompatibility?.[`${nextConfig.mode}:${pack}`] || [];
    if (!compatible.includes(category)) category = compatible[0] || category;
    onChange({
      ...nextConfig,
      category,
      pack
    });
  }
  return <div className="game-setup">
    <h3>Choose your experience</h3>
    <label>Game
      <select value={config.experience} onChange={event => {
        onChange(event.target.value === 'kenyan'
          ? { ...DEFAULT_GAME_CONFIG, experience: 'kenyan', mode: 'comedy', category: 'mixed', language: 'mixed', timerSeconds: 15 }
          : DEFAULT_GAME_CONFIG);
      }}>
        {experiences.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    {config.experience === 'kenyan' && <>
      <label>Game mode
        <select value={config.mode} onChange={event => updateWithCompatibleSettings({ ...config, mode: event.target.value })}>
          {modes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>Category
        <select value={config.category} onChange={event => updateWithCompatibleSettings({ ...config, category: event.target.value })}>
          {categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>Content pack
        <select value={config.pack} onChange={event => updateWithCompatibleSettings({ ...config, pack: event.target.value })}>
          {packs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </>}
    <div className="game-setup-row">
      <label>Language
        <select value={config.language} onChange={event => onChange({ ...config, language: event.target.value })}>
          {(options?.languages || []).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label>Answer timer
        <select value={config.timerSeconds} onChange={event => onChange({ ...config, timerSeconds: Number(event.target.value) })}>
          {(options?.timers || [0, 10, 15, 20]).map(seconds =>
            <option key={seconds} value={seconds}>{seconds ? `${seconds} seconds` : 'Off'}</option>
          )}
        </select>
      </label>
    </div>
    <p>Both players use the same questions, language, and timer.</p>
  </div>;
}

function Stars() {
  return <div className="stars" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>;
}
function Brand() { return <Link className="brand" to="/">AFTER<span>DISTANCE</span></Link>; }
function Shell({ children }) {
  return <main className="app-shell"><Stars /><header><Brand /><div className="presence"><i /> Private room</div></header>{children}</main>;
}
function Landing() {
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [checkAgain, setCheckAgain] = useState(0);
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored.sessionId || !stored.roomCode) return undefined;
    const controller = new AbortController();
    fetch(API + '/api/sessions/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: stored.sessionId, roomCode: stored.roomCode }),
      signal: controller.signal
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) {
        if ([400, 401, 404].includes(response.status)) clearStoredSession();
        throw new Error(data.error || 'Unable to restore your saved game.');
      }
      setResume({ room: data.room, nickname: stored.nickname || data.room?.me?.nickname || '' });
      setResumeError('');
    }).catch(error => {
      if (error.name !== 'AbortError') {
        setResume(null);
        setResumeError(error.message || 'Unable to check your saved game.');
      }
    });
    return () => controller.abort();
  }, [checkAgain]);
  async function resumeGame() {
    const stored = getStoredSession();
    setResumeError('');
    try {
      const response = await fetch(API + '/api/sessions/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stored.sessionId, roomCode: stored.roomCode })
      });
      const data = await response.json();
      if (!response.ok) {
        if ([400, 401, 404].includes(response.status)) {
          clearStoredSession();
          setResume(null);
        }
        throw new Error(data.error || 'Unable to restore your saved game.');
      }
      navigate(`/room/${data.room.roomCode}`);
    } catch (error) {
      setResumeError(error.message || 'Unable to restore your saved game.');
    }
  }
  const gameStatus = resume?.room?.game
    ? resume.room.game.currentPhase === 'COMPLETED'
      ? 'Game completed'
      : `In progress · Round ${resume.room.game.currentRound} of ${resume.room.game.totalRounds}`
    : resume?.room?.partner ? 'Waiting for both players to get ready' : 'Waiting for your partner';
  return <Shell><section className="hero">
    <div className="orb"><div className="heart">♡</div></div>
    <p className="eyebrow">A PRIVATE WORLD FOR TWO</p>
    <h1>Two hearts.<br /><em>One shared world.</em></h1>
    <p className="lead">Turn the distance between you into moments of discovery.</p>
    {resume && <section className="resume-card" aria-label="Existing game">
      <div><p className="eyebrow">YOUR SAVED GAME</p><b>{resume.nickname || 'Your room'} · {resume.room.roomCode}</b><small>{gameStatus}</small></div>
      <button className="button primary" onClick={resumeGame}>Resume Your Game</button>
    </section>}
    {resumeError && <p className="resume-error" role="status">{resumeError} <button className="text-button" onClick={() => setCheckAgain(value => value + 1)}>Try again</button></p>}
    <div className="actions"><Link className="button primary" to="/create">Create a room</Link><Link className="button ghost" to="/join">Join a room</Link></div>
  </section></Shell>;
}
function Entry({ mode }) {
  const navigate = useNavigate();
  const { code: routeCode } = useParams();
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(routeCode ? routeCode.toUpperCase() : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveringInvite, setRecoveringInvite] = useState(() => {
    const stored = getStoredSession();
    return mode === 'join' && Boolean(routeCode && stored.sessionId && stored.roomCode?.toUpperCase() === routeCode.toUpperCase());
  });
  useEffect(() => {
    if (mode !== 'join' || !routeCode) return undefined;
    const stored = getStoredSession();
    if (!stored.sessionId || stored.roomCode?.toUpperCase() !== routeCode.toUpperCase()) return undefined;
    const controller = new AbortController();
    fetch(API + '/api/sessions/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: stored.sessionId, roomCode: stored.roomCode }),
      signal: controller.signal
    }).then(async response => {
      const data = await response.json();
      if (response.ok) {
        navigate(`/room/${data.room.roomCode}`);
        return;
      }
      if ([400, 401, 404].includes(response.status)) clearStoredSession();
      throw new Error(data.error || 'Unable to restore the saved room.');
    }).catch(err => {
      if (err.name !== 'AbortError') setError(err.message || 'Unable to restore the saved room.');
    }).finally(() => {
      if (!controller.signal.aborted) setRecoveringInvite(false);
    });
    return () => controller.abort();
  }, [mode, navigate, routeCode]);
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const endpoint = mode === 'create' ? '/api/rooms' : '/api/rooms/join';
      const body = mode === 'create' ? { nickname } : { nickname, roomCode: code };
      const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not enter the room.');
      if (!saveStoredSession({ sessionId: data.sessionId, roomCode: data.roomCode, nickname })) {
        throw new Error('Your session could not be saved in this browser. Check storage permissions and try again.');
      }
      navigate(`/room/${data.roomCode}`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <Shell><section className="entry-card">
    <p className="eyebrow">{mode === 'create' ? 'BEGIN TOGETHER' : 'ENTER YOUR WORLD'}</p>
    <h2>{mode === 'create' ? 'Create a private room' : 'Join your partner'}</h2>
    {recoveringInvite && <p role="status">Checking your saved session for this room…</p>}
    <form onSubmit={submit}>
      {mode === 'join' && <label>Invitation code<input value={code} onChange={e => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase())} placeholder="XXXXXXXXXXXX" maxLength={12} required /></label>}
      <label>Your nickname<input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="How should your partner know you?" minLength={2} maxLength={24} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={loading || recoveringInvite}>{recoveringInvite ? 'Restoring...' : loading ? 'Opening...' : mode === 'create' ? 'Create my room' : 'Join room'} <span>→</span></button>
    </form>
  </section></Shell>;
}

function RoomPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [recoveryError, setRecoveryError] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerStyle, setAnswerStyle] = useState('');
  const [prediction, setPrediction] = useState('');
  const [socketError, setSocketError] = useState('');
  const [invitationFeedback, setInvitationFeedback] = useState('');
  const [configDraft, setConfigDraft] = useState(DEFAULT_GAME_CONFIG);
  const [serverOffset, setServerOffset] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [exitAction, setExitAction] = useState(null);
  const stored = getStoredSession();
  const sessionId = stored.sessionId;
  const roomCode = stored.roomCode;
  const sessionMatchesRoom = Boolean(sessionId && roomCode && roomCode.toUpperCase() === code.toUpperCase());
  function syncRoom(nextRoom) {
    setRoom(nextRoom);
    if (nextRoom?.game?.serverNow) setServerOffset(nextRoom.game.serverNow - Date.now());
  }
  useEffect(() => {
    if (!sessionMatchesRoom) return undefined;
    const socket = io(API, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 300, timeout: 5000 });
    let connectedBefore = false;
    socket.on('connect', () => {
      setStatus(connectedBefore ? 'Connection restored' : 'Connected');
      connectedBefore = true;
      setRecoveryError('');
      socket.emit('room:join', { roomCode, sessionId }, result => {
        if (result?.ok) {
          syncRoom(result.room);
          setRecoveryError('');
        } else {
          setRoom(null);
          if (/room not found/i.test(result?.error || '')) {
            clearStoredSession();
            setRecoveryError('Room no longer available. Return Home to start or join another room.');
          } else if (/session|member/i.test(result?.error || '')) {
            clearStoredSession();
            setRecoveryError('Session expired or invalid. Return Home to join an available room.');
          } else {
            setRecoveryError(result?.error || 'Unable to restore game.');
          }
        }
      });
    });
    socket.on('disconnect', () => setStatus('Reconnecting...'));
    socket.on('connect_error', () => setStatus('Reconnecting...'));
    socket.on('room:updated', syncRoom);
    socket.on('player:offline', () => setStatus('Your partner is offline'));
    socket.on('player:online', () => setStatus('Your partner has reconnected'));
    socket.on('player:left', () => setStatus('Your partner left the game'));
    socket.on('connection:restored', () => setStatus('Your partner has reconnected'));
    socket.on('error:occurred', payload => setSocketError(payload?.error || 'A connection error occurred.'));
    window.adSocket = socket;
    return () => {
      socket.disconnect();
      if (window.adSocket === socket) delete window.adSocket;
    };
  }, [code, roomCode, sessionId, sessionMatchesRoom]);
  useEffect(() => {
    if (room?.gameConfig) setConfigDraft(room.gameConfig);
    else if (!room?.game) setConfigDraft(DEFAULT_GAME_CONFIG);
  }, [room?.gameConfig, room?.game]);
  useEffect(() => { setAnswer(''); setAnswerStyle(''); setPrediction(''); }, [room?.game?.currentRound, room?.game?.currentPhase]);
  useEffect(() => {
    if (!room?.game?.deadlineAt) return undefined;
    setClockNow(Date.now());
    const timer = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [room?.game?.deadlineAt]);
  if (!stored.sessionId) return <Shell><section className="entry-card"><h2>Session unavailable</h2><p>Your saved session could not be found. Resume from Home or join with a valid invitation.</p><Link className="button primary" to="/">Return home</Link></section></Shell>;
  if (!sessionMatchesRoom) return <Shell><section className="entry-card"><h2>Session unavailable</h2><p>No saved session matches this room. Resume from Home or use a valid invitation.</p><Link className="button primary" to="/">Return home</Link></section></Shell>;
  if (!room && recoveryError) return <Shell><section className="entry-card"><h2>Unable to restore game</h2><p className="error" role="alert">{recoveryError}</p><Link className="button primary" to="/">Return home</Link></section></Shell>;
  if (!room) return <Shell><section className="entry-card"><div className="loader" /><h2>Opening your room...</h2><p>{status}</p></section></Shell>;
  const me = room.me;
  const partner = room.partner;
  const game = room.game;
  const timerRemaining = game?.deadlineAt
    ? Math.max(0, Math.ceil((game.deadlineAt - (clockNow + serverOffset)) / 1000))
    : null;
  const timerExpired = timerRemaining === 0;
  function emit(event, payload) {
    window.adSocket?.emit(
      event,
      { roomCode: stored.roomCode, sessionId: stored.sessionId, ...payload },
      result => {
        if (result && result.ok === false) setSocketError(result.error || 'The request could not be completed.');
      }
    );
  }
  function ready() { emit('player:ready', { ready: !me.ready }); }
  function configure(config) {
    setConfigDraft(config);
    emit('game:configure', { config });
  }
  async function copyInvitation(value, successMessage) {
    try {
      await copyInvitationText(value);
      setInvitationFeedback(successMessage);
    } catch {
      setInvitationFeedback('Could not copy. Please copy it manually.');
    }
  }
  function returnHome() {
    setExitAction('home');
  }
  function leaveGame() {
    setExitAction('leave');
  }
  function confirmExit() {
    if (exitAction === 'home') {
      navigate('/');
      return;
    }
    if (exitAction === 'leave') {
      window.adSocket?.emit('room:leave', { roomCode: stored.roomCode, sessionId: stored.sessionId }, result => {
        if (result?.ok) navigate('/');
        else setSocketError(result?.error || 'Could not leave the game.');
      });
    }
  }

  return <Shell><section className="room-layout">
    <aside><p className="eyebrow">SHARED ROOM</p><div className="room-code"><h3>{stored.roomCode}</h3><button className="copy" onClick={() => copyInvitation(stored.roomCode, 'Room code copied.')}>Copy Room Code</button></div>
      <div className="room-actions">
        <button className="button ghost" onClick={returnHome} aria-label="Return Home">Return Home</button>
        <button className="text-button" onClick={leaveGame}>Leave Game</button>
      </div>
      <div className="player-card"><span className="avatar">{me?.nickname?.[0]}</span><div><b>{me?.nickname}</b><small>{me?.online ? 'You · Online' : 'Offline'}</small></div></div>
      {partner ? <div className="player-card"><span className="avatar partner-avatar">{partner.nickname[0]}</span><div><b>{partner.nickname}</b><small>{partner.online ? 'Partner · Online' : 'Offline'}</small></div></div> :
        <div className="waiting-card"><div className="pulse" /><span>Waiting for your partner</span>
          <div className="invitation-actions">
            <a className="button ghost" href={getWhatsAppShareUrl(stored.roomCode)} target="_blank" rel="noopener noreferrer">Invite via WhatsApp</a>
            <button className="button ghost" onClick={() => copyInvitation(getInvitationLink(stored.roomCode), 'Invitation link copied.')}>Copy Invitation Link</button>
          </div>
        </div>}
      {invitationFeedback && <p className="invitation-feedback" role="status" aria-live="polite">{invitationFeedback}</p>}
    </aside>
    <div className="game-panel"><div className="connection"><i /> {status}</div>
      {socketError && <p className="error" role="alert">{socketError}</p>}
      {!game ? <>
        <p className="eyebrow">CHOOSE YOUR FIRST MEMORY</p><h2>Ready when you both are.</h2>
        <GameSetup options={room.gameOptions} config={configDraft} onChange={configure} />
        <button className="game-card" onClick={() => emit('game:start', {})}><span className="game-icon">✦</span><div><b>{configDraft.experience === 'kenyan' ? 'Kenyan Comedy Experience' : 'The Other Side of Us'}</b><small>Five rounds · Shared questions · Your choices stay private</small></div><span>→</span></button>
        <button className={`button ${me.ready ? 'ghost' : 'primary'}`} onClick={ready}>{me.ready ? 'Unready' : 'I’m ready'}</button>
        {partner && partner.ready && <p className="partner-ready">Your partner is ready.</p>}
      </> : game.currentPhase === 'COMPLETED' ? <Completed game={game} emit={emit} /> :
      game.currentPhase === 'ROUND_RESULTS' ? <Results game={game} emit={emit} room={room} me={me} /> :
      <>
        <p className="eyebrow">{game.round?.isSurpriseRound ? 'SURPRISE ROUND · ' : ''}ROUND {game.currentRound} OF {game.totalRounds} · {game.round?.category}</p><h2>{game.round?.scenario}</h2>
        {game.privateInfo && <div className="private-note">Your perspective<br /><b>{game.privateInfo}</b></div>}
        {timerRemaining !== null && <p className={`round-timer ${timerExpired ? 'expired' : ''}`} role="timer" aria-live="polite">
          {timerExpired ? 'Time is up' : `${timerRemaining} seconds remaining`}
        </p>}
        {game.currentPhase === 'ANSWERING' && !game.submittedAnswer ? <>
          <p className="question">{game.round?.question}</p>
          {game.round?.answerType === 'text' ? <>
            <label className="story-answer">Your ending
              <textarea value={answer} maxLength={280} onChange={event => setAnswer(event.target.value)} placeholder="Finish the story in your own words…" />
            </label>
            <p className="character-count">{answer.length}/280</p>
            <p className="choice-prompt">Choose the vibe of your ending</p>
            <div className="choices">{game.round?.predictionChoices?.map(choice => <button key={choice} className={answerStyle === choice ? 'selected' : ''} onClick={() => setAnswerStyle(choice)}>{choiceLabel(choice, room.players)}</button>)}</div>
          </> : <div className="choices">{game.round?.choices?.map(choice => <button key={choice} className={answer === choice ? 'selected' : ''} onClick={() => setAnswer(choice)}>{choiceLabel(choice, room.players)}</button>)}</div>}
          <button className="button primary" disabled={timerExpired || (game.round?.answerType === 'text' ? !answer.trim() || !answerStyle : !answer)} onClick={() => emit('game:answer', { answer, ...(game.round?.answerType === 'text' ? { answerStyle } : {}) })}>Submit privately</button>
        </> : game.currentPhase === 'ANSWERING' ? <Waiting partnerText="Waiting for your partner’s answer..." /> :
        game.currentPhase === 'PREDICTING' && !game.submittedPrediction ? <>
          <p className="question">{game.round?.answerType === 'text' ? 'What ending vibe do you think your partner chose?' : 'What do you think your partner chose?'}</p>
          <div className="choices">{(game.round?.predictionChoices || game.round?.choices || []).map(choice => <button key={choice} className={prediction === choice ? 'selected' : ''} onClick={() => setPrediction(choice)}>{choiceLabel(choice, room.players)}</button>)}</div>
          <button className="button primary" disabled={timerExpired || !prediction} onClick={() => emit('game:predict', { prediction })}>Submit prediction</button>
        </> : game.currentPhase === 'PREDICTING' ? <Waiting partnerText="Waiting for your partner’s prediction..." /> :
        <Waiting partnerText="Revealing answers..." />}
        {game.achievements?.length > 0 && <AchievementList achievements={game.achievements} />}
      </>}
    </div>
    {exitAction && <div className="dialog-backdrop">
      <section className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <h2 id="exit-title">{exitAction === 'home' ? 'Return to Home?' : 'Leave Game?'}</h2>
        <p>{exitAction === 'home'
          ? 'Your game session will be preserved. You can return to this room later if it is still available.'
          : 'You will appear offline to your partner. Your room and game progress will remain available until the room expires.'}</p>
        <div className="dialog-actions">
          <button className="button ghost" onClick={() => setExitAction(null)}>Continue Playing</button>
          <button className="button primary" onClick={confirmExit}>{exitAction === 'home' ? 'Return Home' : 'Leave Game'}</button>
        </div>
      </section>
    </div>}
  </section></Shell>;
}
function Waiting({ partnerText }) { return <div className="waiting-state"><div className="orbit" /><h3>Choice received</h3><p>{partnerText}</p></div>; }
function AchievementList({ achievements }) {
  if (!achievements?.length) return null;
  return <section className="achievement-list" aria-live="polite">
    <h3>Achievements unlocked</h3>
    <div>{achievements.map(item => <article key={item.id}><span aria-hidden="true">{item.icon}</span><b>{item.label}</b><small>{item.description}</small></article>)}</div>
  </section>;
}
function Results({ game, emit, room }) {
  const result = game.roundResults;
  if (!result) return <Waiting partnerText="Preparing your reveal..." />;
  const textAnswers = game.round?.answerType === 'text';
  const yourAnswer = result.yourAnswer === null
    ? 'Time ran out'
    : choiceLabel(result.yourAnswer, room.players);
  const partnerAnswer = result.partnerAnswer === null
    ? 'Time ran out'
    : choiceLabel(result.partnerAnswer, room.players);
  return <div className="results"><p className="eyebrow">REVEAL · ROUND {result.round}</p><h2>Here is what you both chose.</h2>
    {result.message && <p className="reveal-message" role="status">{result.message}</p>}
    <div className="reveal-row"><b>{yourAnswer}</b><small>{textAnswers ? `Your ending · ${result.yourAnswerStyle || 'No style selected'}` : 'Your choice'}</small></div>
    <div className="reveal-row"><b>{partnerAnswer}</b><small>{textAnswers ? `Partner’s ending · ${result.partnerAnswerStyle || 'No style selected'}` : 'Partner’s choice'}</small></div>
    {result.correctAnswer && <p className="correct-answer">Correct meaning: <b>{result.correctAnswer}</b></p>}
    <p className="explanation">{result.explanation}</p>
    <button className="button primary" onClick={() => emit('game:next-round', {})}>{game.readyForNext ? 'Waiting for partner...' : 'Continue'}</button>
    <AchievementList achievements={game.achievements} />
  </div>;
}
function Completed({ game, emit }) {
  const entries = [
    ['You', game.scores?.you || 0],
    ['Partner', game.scores?.partner || 0]
  ];
  return <div className="results"><p className="eyebrow">YOUR SHARED STORY</p><h2>Game completed</h2><div className="score">{entries.map(([id, score]) => <div key={id}><b>{score}</b><small>Connection points</small></div>)}</div>
    <AchievementList achievements={game.achievements} />
    <button className="button primary" onClick={() => emit('game:replay', {})}>Play again</button></div>;
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Landing />} /><Route path="/create" element={<Entry mode="create" />} />
    <Route path="/join" element={<Entry mode="join" />} /><Route path="/join/:code" element={<Entry mode="join" />} />
    <Route path="/room/:code" element={<RoomPage />} />
  </Routes></BrowserRouter>;
}
