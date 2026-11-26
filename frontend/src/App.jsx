import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { copyInvitationText, getInvitationLink, getWhatsAppShareUrl } from './invitations.js';
import {
  clearRoomCreationRequestId,
  clearStoredSession,
  getRoomCreationRequestId,
  getStoredSession,
  saveStoredSession
} from './session.js';
import { CentreRoute } from './HelpLegal.jsx';

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

function ExperienceSelection({ room, config, onChange, onSelectExperience, onRequestSwitch }) {
  const options = room.gameOptions || {};
  const names = new Map((options.modes || []).map(item => [item.id, item.label]));
  const languages = new Map((options.languages || []).map(item => [item.id, item.label]));
  const currentExperience = room.game?.config?.experience;
  return <section className="experience-selection">
    <p className="eyebrow">YOUR NEXT SHARED STORY</p>
    <h2>Choose an Experience</h2>
    <p className="experience-intro">Both players must agree before the current session changes. Each available experience starts as a fresh five-round game.</p>
    <div className="experience-cards">
      {options.experiences?.map(experience => <article
        className={`experience-card ${config.experience === experience.id ? 'selected' : ''}`}
        key={experience.id}
      >
        <div className="experience-card-heading">
          <h3>{experience.label}</h3>
          <span className={experience.available ? 'availability available' : 'availability'}>
            {experience.available ? 'Available' : 'Coming soon'}
          </span>
        </div>
        <p>{experience.description}</p>
        <dl>
          <div><dt>Category</dt><dd>{experience.category}</dd></div>
          <div><dt>Modes</dt><dd>{experience.modes.map(id => names.get(id) || id).join(' · ')}</dd></div>
          <div><dt>Languages</dt><dd>{experience.languages.map(id => languages.get(id) || id).join(' · ')}</dd></div>
        </dl>
        <button
          className="button ghost"
          disabled={!experience.available}
          aria-pressed={config.experience === experience.id}
          onClick={() => onSelectExperience(experience.id)}
        >{config.experience === experience.id ? 'Selected' : 'Select Experience'}</button>
        {currentExperience === experience.id && <small className="current-experience">Current experience</small>}
      </article>)}
    </div>
    {config.experience === 'kenyan' && <GameSetup options={options} config={config} onChange={onChange} />}
    <div className="experience-actions">
      <button className="button primary" disabled={!room.partner || !options.experiences?.find(item => item.id === config.experience)?.available || Boolean(room.switchRequest)} onClick={onRequestSwitch}>
        Request Experience Switch
      </button>
      <Link className="button ghost" to={`/room/${room.roomCode}`}>Continue Current Experience</Link>
    </div>
    {!room.partner && <p className="experience-status">Invite your partner before requesting an experience change.</p>}
    {room.partner && !room.partner.online && <p className="experience-status">Your partner is disconnected. You can save a request, but they must reconnect before approving.</p>}
  </section>;
}

function Stars() {
  return <div className="stars" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>;
}
function Brand() { return <Link className="brand" to="/">AFTER<span>DISTANCE</span></Link>; }
function Shell({ children }) {
  return <main className="app-shell"><Stars /><header className="site-header"><Brand /><div className="presence"><i /> Private room</div></header>{children}<Footer /></main>;
}

function Footer() {
  return <footer className="site-footer" aria-label="Help, legal and contact links">
    <nav aria-label="Help, Legal and Contact">
      <Link to="/help">Help &amp; How to Play</Link>
      <Link to="/copyright">Copyright</Link>
      <Link to="/privacy-policy">Privacy Policy</Link>
      <Link to="/terms">User Agreement</Link>
      <Link to="/contact">Contact Us</Link>
    </nav>
    <small>© {new Date().getFullYear()} AfterDistance. All rights reserved.</small>
  </footer>;
}
function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
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
    {location.state?.privacyNotice && <p className="privacy-notice" role="status">{location.state.privacyNotice}</p>}
    <Link className="privacy-link" to="/privacy">Privacy &amp; Data Management</Link>
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
      const requestId = mode === 'create' ? getRoomCreationRequestId() : '';
      if (mode === 'create' && !requestId) throw new Error('Room creation could not be made retry-safe in this browser. Check session storage permissions and try again.');
      const headers = { 'Content-Type': 'application/json' };
      if (requestId) headers['Idempotency-Key'] = requestId;
      const response = await fetch(API + endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not enter the room.');
      if (!saveStoredSession({ sessionId: data.sessionId, roomCode: data.roomCode, nickname })) {
        throw new Error('Your session could not be saved in this browser. Check storage permissions and try again.');
      }
      if (requestId) clearRoomCreationRequestId();
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
  const location = useLocation();
  const exploring = location.pathname.startsWith('/experiences/');
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [recoveryError, setRecoveryError] = useState('');
  const [answer, setAnswer] = useState('');
  const [answerStyle, setAnswerStyle] = useState('');
  const [prediction, setPrediction] = useState('');
  const [socketError, setSocketError] = useState('');
  const [invitationFeedback, setInvitationFeedback] = useState('');
  const [configDraft, setConfigDraft] = useState(DEFAULT_GAME_CONFIG);
  const [hasSelectedExperience, setHasSelectedExperience] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [exitAction, setExitAction] = useState(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [switchNotice, setSwitchNotice] = useState('');
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
    socket.on('room:deleted', () => {
      clearStoredSession();
      navigate('/', { replace: true, state: { privacyNotice: 'The room creator deleted this shared game. Your saved room credentials were cleared.' } });
    });
    socket.on('connection:restored', () => setStatus('Your partner has reconnected'));
    socket.on('experience:switched', () => {
      setSwitchNotice('Your new experience is ready. Both players must choose I’m ready to start the fresh session.');
      navigate(`/room/${roomCode}`, { replace: true });
    });
    socket.on('error:occurred', payload => setSocketError(payload?.error || 'A connection error occurred.'));
    window.adSocket = socket;
    return () => {
      socket.disconnect();
      if (window.adSocket === socket) delete window.adSocket;
    };
  }, [code, navigate, roomCode, sessionId, sessionMatchesRoom]);
  useEffect(() => {
    if (room?.game) {
      if (!hasSelectedExperience) setConfigDraft(room.game.config);
      return;
    }
    if (room?.gameConfig) setConfigDraft(room.gameConfig);
    else setConfigDraft(DEFAULT_GAME_CONFIG);
  }, [hasSelectedExperience, room?.gameConfig, room?.game]);
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
    setExitAction('leave-experience');
  }
  function confirmExit() {
    if (exitAction === 'home') {
      navigate('/');
      return;
    }
    if (exitAction === 'leave-experience') {
      const socket = window.adSocket;
      if (!socket?.connected) {
        setSocketError('Reconnect before leaving so your departure can be saved.');
        return;
      }
      socket.emit('experience:leave', { roomCode: stored.roomCode, sessionId: stored.sessionId }, result => {
        if (result?.ok) {
          clearStoredSession();
          navigate('/', { replace: true });
        } else setSocketError(result?.error || 'Could not leave the experience.');
      });
    }
  }
  function sendSwitchRequest(kind, config) {
    setSocketError('');
    setSwitchNotice('');
    const socket = window.adSocket;
    if (!socket?.connected) {
      setSocketError('Reconnect before requesting an experience change.');
      return;
    }
    socket.emit(
      'experience:switch-request',
      { roomCode: stored.roomCode, sessionId: stored.sessionId, kind, ...(config ? { config } : {}) },
      result => {
        if (result?.ok) setSwitchNotice('Request sent. The new experience will begin after your partner approves and both players are ready.');
        else setSocketError(result?.error || 'The experience request could not be saved.');
      }
    );
  }
  function respondToSwitch(accept) {
    if (!room?.switchRequest) return;
    const socket = window.adSocket;
    if (!socket?.connected) {
      setSocketError('Reconnect before responding to the experience request.');
      return;
    }
    socket.emit(
      'experience:switch-response',
      {
        roomCode: stored.roomCode,
        sessionId: stored.sessionId,
        requestId: room.switchRequest.requestId,
        accept
      },
      result => {
        if (result?.ok) setSwitchNotice(accept
          ? 'You both approved. Choose Continue Current Experience to ready up for the new session.'
          : 'You declined the experience request. Your current session is unchanged.');
        else setSocketError(result?.error || 'Your response could not be saved.');
      }
    );
  }

  return <Shell><section className="room-layout">
    <aside><p className="eyebrow">SHARED ROOM</p><div className="room-code"><h3>{stored.roomCode}</h3><button className="copy" onClick={() => copyInvitation(stored.roomCode, 'Room code copied.')}>Copy Room Code</button></div>
      <div className="room-actions">
        <button className="button ghost" onClick={returnHome} aria-label="Return Home">Return Home</button>
        {game && <Link className="text-button" to={`/experiences/${stored.roomCode}`}>Explore Other Experiences</Link>}
        <button className="text-button" onClick={leaveGame}>Leave Experience</button>
        <Link className="text-button" to="/privacy">Privacy &amp; Data Management</Link>
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
      {switchNotice && <p className="switch-notice" role="status">{switchNotice}</p>}
      {room.switchRequest && (room.switchRequest.requestedByMe
        ? <p className="switch-notice" role="status">
          Waiting for {partner?.nickname || 'your partner'} to approve {room.switchRequest.kind === 'replay' ? 'Play Again' : 'the new experience'}.
          {partner && !partner.online ? ' They are offline; the request will remain pending until they reconnect.' : ''}
        </p>
        : <section className="switch-request" aria-label="Experience change request">
          <h3>{room.switchRequest.requestedBy} wants to {room.switchRequest.kind === 'replay' ? 'play again' : `switch to ${room.gameOptions.experiences.find(item => item.id === room.switchRequest.config.experience)?.label || 'another experience'}`}.</h3>
          <p>Nothing changes until you approve. Both players must be connected and ready before the new session starts.</p>
          {partner && !partner.online && <p className="error">The requesting player is offline. Reconnect before approving.</p>}
          <div className="switch-actions">
            <button className="button ghost" onClick={() => respondToSwitch(false)}>Decline</button>
            <button className="button primary" disabled={!partner?.online} onClick={() => respondToSwitch(true)}>Approve</button>
          </div>
        </section>)}
      {exploring ? <ExperienceSelection
        room={room}
        config={configDraft}
        onChange={setConfigDraft}
        onSelectExperience={experience => {
          setSocketError('');
          setHasSelectedExperience(true);
          const next = experience === 'kenyan'
            ? { ...DEFAULT_GAME_CONFIG, experience, mode: 'comedy', category: 'mixed', language: 'mixed', timerSeconds: 15 }
            : DEFAULT_GAME_CONFIG;
          setConfigDraft(next);
        }}
        onRequestSwitch={() => game?.currentPhase === 'COMPLETED'
          ? sendSwitchRequest('switch', configDraft)
          : setConfirmSwitch(true)}
      /> : !game ? <>
        <p className="eyebrow">CHOOSE YOUR FIRST MEMORY</p><h2>Ready when you both are.</h2>
        <GameSetup options={room.gameOptions} config={configDraft} onChange={configure} />
        <button className="game-card" onClick={() => emit('game:start', {})}><span className="game-icon">✦</span><div><b>{configDraft.experience === 'kenyan' ? 'Kenyan Comedy Experience' : 'The Other Side of Us'}</b><small>Five rounds · Shared questions · Your choices stay private</small></div><span>→</span></button>
        <button className={`button ${me.ready ? 'ghost' : 'primary'}`} onClick={ready}>{me.ready ? 'Unready' : 'I’m ready'}</button>
        {partner && partner.ready && <p className="partner-ready">Your partner is ready.</p>}
      </> : game.currentPhase === 'COMPLETED' ? <Completed
        game={game}
        room={room}
        onReplay={() => sendSwitchRequest('replay')}
        onExplore={() => navigate(`/experiences/${stored.roomCode}`)}
        onHome={() => navigate('/')}
      /> :
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
    {confirmSwitch && <div className="dialog-backdrop">
      <section className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="switch-title">
        <h2 id="switch-title">Request another experience?</h2>
        <p>Your current active session will end only if your partner approves. Its unfinished progress will not become a completed result; completed game history remains saved. Your partner must be connected to approve, and both of you must ready up before a fresh session starts.</p>
        <div className="dialog-actions">
          <button className="button ghost" onClick={() => setConfirmSwitch(false)}>Continue Current Experience</button>
          <button className="button primary" disabled={Boolean(room.switchRequest)} onClick={() => {
            setConfirmSwitch(false);
            sendSwitchRequest('switch', configDraft);
          }}>Request Experience Switch</button>
        </div>
      </section>
    </div>}
    {exitAction && <div className="dialog-backdrop">
      <section className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <h2 id="exit-title">{exitAction === 'home' ? 'Return to Home?' : 'Leave Experience?'}</h2>
        <p>{exitAction === 'home'
          ? 'Your game session will be preserved. You can return to this room later if it is still available.'
          : 'You will lose access to this room from this browser and cannot resume this player session. Your partner can continue or invite someone else. Completed results are retained; your partner’s independent data is not deleted.'}</p>
        <div className="dialog-actions">
          <button className="button ghost" onClick={() => setExitAction(null)}>Continue Current Experience</button>
          <button className="button primary" onClick={confirmExit}>{exitAction === 'home' ? 'Return Home' : 'Leave Experience'}</button>
        </div>
      </section>
    </div>}
  </section></Shell>;
}

const privacyActions = {
  identity: {
    title: 'Delete My Data',
    confirm: 'Confirm Deletion',
    description: 'This permanently deletes your guest identity, nickname, session credential, and personal answers and predictions. Your current shared room remains for the other player, but its game progress is cleared and your membership is removed.'
  },
  all: {
    title: 'Delete All My Data',
    confirm: 'Delete All My Data',
    description: 'This permanently removes or anonymizes all records linked to your guest session across AfterDistance, including shared historical answers, predictions, scores, and participation. The other player’s profile remains; current shared game progress may be reset.'
  },
  leave: {
    title: 'Leave Current Game',
    confirm: 'Leave Game',
    description: 'You will appear offline and your active socket will be disconnected. Your guest session and saved game data are retained, and you may rejoin while the room remains available.'
  },
  room: {
    title: 'Delete This Game',
    confirm: 'Delete Game',
    description: 'This permanently deletes the shared room and saved progress, so the other player will lose access too. Only the authenticated room creator can do this.'
  }
};

function PrivacyPage() {
  const navigate = useNavigate();
  const stored = getStoredSession();
  const [room, setRoom] = useState(null);
  const [roomStatus, setRoomStatus] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasSession = Boolean(stored.sessionId && stored.roomCode);

  useEffect(() => {
    if (!hasSession) return undefined;
    const controller = new AbortController();
    fetch(API + '/api/sessions/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: stored.sessionId, roomCode: stored.roomCode }),
      signal: controller.signal
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your saved room could not be verified.');
      setRoom(data.room);
      setRoomStatus('');
    }).catch(fetchError => {
      if (fetchError.name !== 'AbortError') {
        setRoom(null);
        setRoomStatus(fetchError.message || 'Your saved room could not be verified.');
      }
    });
    return () => controller.abort();
  }, [hasSession, stored.roomCode, stored.sessionId]);

  async function performAction() {
    if (!confirmAction || !hasSession || busy) return;
    setBusy(true);
    setError('');
    const route = confirmAction === 'identity'
      ? '/api/privacy/delete-my-data'
      : confirmAction === 'all'
        ? '/api/privacy/delete-all-my-data'
        : confirmAction === 'leave'
          ? '/api/rooms/leave'
          : '/api/rooms/delete';
    try {
      const response = await fetch(API + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stored.sessionId, roomCode: stored.roomCode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
      const notice = confirmAction === 'leave'
        ? 'You left the game. Your guest session and saved data were preserved.'
        : confirmAction === 'room'
          ? 'The shared game and its saved progress were deleted.'
          : 'Your personal data deletion is complete and your session has been invalidated.';
      if (confirmAction !== 'leave') clearStoredSession();
      setConfirmAction(null);
      navigate('/', { replace: true, state: { privacyNotice: notice } });
    } catch (requestError) {
      setError(requestError.message || 'The request could not be completed. You can retry.');
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    { id: 'identity', title: 'Delete My Data', detail: 'Remove your guest identity and personal game activity while keeping the room for the other player.' },
    { id: 'leave', title: 'Leave Current Game', detail: 'Disconnect from the room without deleting your guest session or game records.', disabled: !room },
    { id: 'room', title: 'Delete This Game', detail: 'Remove the shared room and saved game progress. Available to the room creator only.', disabled: !room?.canDelete && !roomStatus.includes('Shared-game deletion is pending') },
    { id: 'all', title: 'Delete All My Data', detail: 'Run a full cross-collection deletion and anonymization for this guest session.' }
  ];

  return <Shell><section className="privacy-page">
    <p className="eyebrow">YOUR ACCOUNT IS A GUEST SESSION</p>
    <h1>Privacy &amp; Data Management</h1>
    <p className="privacy-intro">AfterDistance stores a guest token and nickname, room membership, and server-side game state. Answers and predictions stay private until the game reveals them.</p>
    {!hasSession && <p className="privacy-status">No saved guest session was found in this browser. You can still review these controls; actions require an authenticated session.</p>}
    {roomStatus && <p className="privacy-status" role="status">{roomStatus} {roomStatus.includes('Shared-game deletion is pending')
      ? 'The creator can retry the shared deletion below.'
      : roomStatus.includes('Deletion is pending')
        ? 'Retry the personal-data deletion below.'
        : 'Your saved credentials are retained while this request is unresolved.'}</p>}
    {room && <p className="privacy-status">Current room: {room.roomCode} · Room expires at {new Date(room.expiresAt).toLocaleString()}.</p>}
    <div className="privacy-actions">
      {actions.map(action => <article key={action.id}>
        <div><h2>{action.title}</h2><p>{action.detail}</p></div>
        <button className="button ghost" disabled={!hasSession || action.disabled || busy} onClick={() => { setError(''); setConfirmAction(action.id); }}>
          {action.title}
        </button>
      </article>)}
    </div>
    <p className="privacy-policy">In this guest-only model, the same session token identifies one active room and no separate account preferences. “Delete All My Data” therefore performs the same full session-wide sweep as “Delete My Data.” The other player’s independent guest identity is preserved. If one player’s data is deleted, shared in-progress play is reset rather than deleting the surviving player or room. Minimal one-way token hashes are retained in deletion fences to prevent stale writes and backup restores from reconnecting deleted sessions; raw tokens are not stored in those fences.</p>
    <p className="privacy-policy">Room data is retained until its 24-hour expiry unless the creator deletes it. Deletion covers the live MongoDB collections; historical Atlas backups may retain earlier copies until their configured retention expires. The repository does not specify the Atlas backup plan. After restoring a backup, operators must reconcile deletion records before serving traffic.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <Link className="text-button" to="/">Return Home</Link>
    {confirmAction && <div className="dialog-backdrop">
      <section className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-confirm-title">
        <h2 id="privacy-confirm-title">{privacyActions[confirmAction].title}</h2>
        <p>{privacyActions[confirmAction].description}</p>
        <div className="dialog-actions">
          <button className="button ghost" disabled={busy} onClick={() => setConfirmAction(null)}>Cancel</button>
          <button className="button primary" disabled={busy} onClick={performAction}>
            {busy ? 'Working…' : privacyActions[confirmAction].confirm}
          </button>
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
function Completed({ game, room, onReplay, onExplore, onHome }) {
  const entries = [
    ['You', game.scores?.you || 0],
    ['Partner', game.scores?.partner || 0]
  ];
  return <div className="results"><p className="eyebrow">YOUR SHARED STORY</p><h2>Game completed</h2>
    <div className="score">{entries.map(([id, score]) => <div key={id}><b>{score}</b><small>{id} · Connection points</small></div>)}</div>
    {game.completedResults?.length > 0 && <section className="completed-rounds" aria-label="Game results">
      <h3>Game results</h3>
      {game.completedResults.map(result => <article key={result.round}>
        <b>Round {result.round}</b>
        <p>You: {result.yourAnswer === null ? 'Time ran out' : choiceLabel(result.yourAnswer, room.players)}</p>
        <p>Partner: {result.partnerAnswer === null ? 'Time ran out' : choiceLabel(result.partnerAnswer, room.players)}</p>
        {result.explanation && <small>{result.explanation}</small>}
      </article>)}
    </section>}
    <AchievementList achievements={game.achievements} />
    <div className="completed-actions">
      <button className="button primary" onClick={onReplay}>Play Again</button>
      <button className="button ghost" onClick={onExplore}>Explore Other Experiences</button>
      <button className="text-button" onClick={onHome}>Return Home</button>
    </div>
  </div>;
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Landing />} /><Route path="/create" element={<Entry mode="create" />} />
    <Route path="/join" element={<Entry mode="join" />} /><Route path="/join/:code" element={<Entry mode="join" />} />
    <Route path="/room/:code" element={<RoomPage />} />
    <Route path="/experiences/:code" element={<RoomPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/help" element={<Shell><CentreRoute page="help" /></Shell>} />
    <Route path="/copyright" element={<Shell><CentreRoute page="copyright" /></Shell>} />
    <Route path="/privacy-policy" element={<Shell><CentreRoute page="privacy" /></Shell>} />
    <Route path="/terms" element={<Shell><CentreRoute page="terms" /></Shell>} />
    <Route path="/contact" element={<Shell><CentreRoute page="contact" /></Shell>} />
  </Routes></BrowserRouter>;
}
