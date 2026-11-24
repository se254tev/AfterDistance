import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { getStoredSession, saveStoredSession } from './session.js';

const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
  || (import.meta.env.PROD ? '' : 'http://localhost:3001');

function Stars() {
  return <div className="stars" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>;
}
function Brand() { return <Link className="brand" to="/">AFTER<span>DISTANCE</span></Link>; }
function Shell({ children }) {
  return <main className="app-shell"><Stars /><header><Brand /><div className="presence"><i /> Private room</div></header>{children}</main>;
}
function Landing() {
  return <Shell><section className="hero">
    <div className="orb"><div className="heart">♡</div></div>
    <p className="eyebrow">A PRIVATE WORLD FOR TWO</p>
    <h1>Two hearts.<br /><em>One shared world.</em></h1>
    <p className="lead">Turn the distance between you into moments of discovery.</p>
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
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const endpoint = mode === 'create' ? '/api/rooms' : '/api/rooms/join';
      const body = mode === 'create' ? { nickname } : { nickname, roomCode: code };
      const response = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not enter the room.');
      saveStoredSession({ sessionId: data.sessionId, roomCode: data.roomCode, nickname });
      navigate(`/room/${data.roomCode}`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <Shell><section className="entry-card">
    <p className="eyebrow">{mode === 'create' ? 'BEGIN TOGETHER' : 'ENTER YOUR WORLD'}</p>
    <h2>{mode === 'create' ? 'Create a private room' : 'Join your partner'}</h2>
    <form onSubmit={submit}>
      {mode === 'join' && <label>Invitation code<input value={code} onChange={e => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase())} placeholder="XXXXXXXXXXXX" maxLength={12} required /></label>}
      <label>Your nickname<input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="How should your partner know you?" minLength={2} maxLength={24} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={loading}>{loading ? 'Opening...' : mode === 'create' ? 'Create my room' : 'Join room'} <span>→</span></button>
    </form>
  </section></Shell>;
}

function RoomPage() {
  const { code } = useParams();
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [answer, setAnswer] = useState('');
  const [prediction, setPrediction] = useState('');
  const [socketError, setSocketError] = useState('');
  const stored = getStoredSession();
  useEffect(() => {
    if (!stored.sessionId || !stored.roomCode || stored.roomCode !== code) return;
    const socket = io(API, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 300, timeout: 5000 });
    socket.on('connect', () => {
      setStatus('Connected');
      socket.emit('room:join', { roomCode: stored.roomCode, sessionId: stored.sessionId }, result => result?.ok && setRoom(result.room));
    });
    socket.on('disconnect', () => setStatus('Reconnecting...'));
    socket.on('room:updated', setRoom);
    socket.on('player:offline', () => setStatus('Partner offline'));
    socket.on('player:online', () => setStatus('Partner is online'));
    socket.on('connection:restored', () => setStatus('Connection restored'));
    socket.on('error:occurred', payload => setSocketError(payload?.error || 'A connection error occurred.'));
    window.adSocket = socket;
    return () => { socket.disconnect(); delete window.adSocket; };
  }, [code]);
  useEffect(() => { setAnswer(''); setPrediction(''); }, [room?.game?.currentRound, room?.game?.currentPhase]);
  if (!stored.sessionId) return <Shell><section className="entry-card"><h2>Session unavailable</h2><Link className="button primary" to="/">Return home</Link></section></Shell>;
  if (!room) return <Shell><section className="entry-card"><div className="loader" /><h2>Opening your room...</h2></section></Shell>;
  const me = room.me;
  const partner = room.partner;
  const game = room.game;
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

  return <Shell><section className="room-layout">
    <aside><p className="eyebrow">SHARED ROOM</p><h3>{stored.roomCode}</h3>
      <div className="player-card"><span className="avatar">{me?.nickname?.[0]}</span><div><b>{me?.nickname}</b><small>{me?.online ? 'You · Online' : 'Offline'}</small></div></div>
      {partner ? <div className="player-card"><span className="avatar partner-avatar">{partner.nickname[0]}</span><div><b>{partner.nickname}</b><small>{partner.online ? 'Partner · Online' : 'Offline'}</small></div></div> :
        <div className="waiting-card"><div className="pulse" /><span>Waiting for your partner</span><button className="copy" onClick={() => navigator.clipboard?.writeText(`${location.origin}/join/${stored.roomCode}`)}>Copy invitation link</button></div>}
    </aside>
    <div className="game-panel"><div className="connection"><i /> {status}</div>
      {socketError && <p className="error" role="alert">{socketError}</p>}
      {!game ? <>
        <p className="eyebrow">CHOOSE YOUR FIRST MEMORY</p><h2>Ready when you both are.</h2>
        <button className="game-card" onClick={() => emit('game:start', {})}><span className="game-icon">✦</span><div><b>The Other Side of Us</b><small>Five rounds · Understand one another</small></div><span>→</span></button>
        <button className={`button ${me.ready ? 'ghost' : 'primary'}`} onClick={ready}>{me.ready ? 'Unready' : 'I’m ready'}</button>
        {partner && partner.ready && <p className="partner-ready">Your partner is ready.</p>}
      </> : game.currentPhase === 'COMPLETED' ? <Completed game={game} emit={emit} /> :
      game.currentPhase === 'ROUND_RESULTS' ? <Results game={game} emit={emit} me={me} /> :
      <>
        <p className="eyebrow">ROUND {game.currentRound} OF {game.totalRounds} · {game.round?.category}</p><h2>{game.round?.scenario}</h2>
        <div className="private-note">Your perspective<br /><b>{game.privateInfo}</b></div>
        {game.currentPhase === 'ANSWERING' && !game.submittedAnswer ? <>
          <p className="question">{game.round?.question}</p><div className="choices">{game.round?.choices.map(choice => <button key={choice} className={answer === choice ? 'selected' : ''} onClick={() => setAnswer(choice)}>{choice}</button>)}</div>
          <button className="button primary" disabled={!answer} onClick={() => emit('game:answer', { answer })}>Submit privately</button>
        </> : game.currentPhase === 'ANSWERING' ? <Waiting partnerText="Waiting for your partner’s answer..." /> :
        game.currentPhase === 'PREDICTING' && !game.submittedPrediction ? <>
          <p className="question">What do you think your partner chose?</p><div className="choices">{game.round?.choices.map(choice => <button key={choice} className={prediction === choice ? 'selected' : ''} onClick={() => setPrediction(choice)}>{choice}</button>)}</div>
          <button className="button primary" disabled={!prediction} onClick={() => emit('game:predict', { prediction })}>Submit prediction</button>
        </> : game.currentPhase === 'PREDICTING' ? <Waiting partnerText="Waiting for your partner’s prediction..." /> :
        <Waiting partnerText="Revealing answers..." />}
      </>}
    </div>
  </section></Shell>;
}
function Waiting({ partnerText }) { return <div className="waiting-state"><div className="orbit" /><h3>Choice received</h3><p>{partnerText}</p></div>; }
function Results({ game, emit, me }) {
  const result = game.roundResults;
  if (!result) return <Waiting partnerText="Preparing your reveal..." />;
  return <div className="results"><p className="eyebrow">REVEAL · ROUND {result.round}</p><h2>Here is what you both chose.</h2>
    <div className="reveal-row"><b>{result.yourAnswer}</b><small>Your choice</small></div>
    <div className="reveal-row"><b>{result.partnerAnswer}</b><small>Partner’s choice</small></div>
    <p className="explanation">{result.explanation}</p><button className="button primary" onClick={() => emit('game:next-round', {})}>{game.readyForNext ? 'Waiting for partner...' : 'Continue'}</button></div>;
}
function Completed({ game, emit }) {
  const entries = [
    ['You', game.scores?.you || 0],
    ['Partner', game.scores?.partner || 0]
  ];
  return <div className="results"><p className="eyebrow">YOUR SHARED STORY</p><h2>Game completed</h2><div className="score">{entries.map(([id, score]) => <div key={id}><b>{score}</b><small>Connection points</small></div>)}</div><button className="button primary" onClick={() => emit('game:replay', {})}>Play again</button></div>;
}

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<Landing />} /><Route path="/create" element={<Entry mode="create" />} />
    <Route path="/join" element={<Entry mode="join" />} /><Route path="/join/:code" element={<Entry mode="join" />} />
    <Route path="/room/:code" element={<RoomPage />} />
  </Routes></BrowserRouter>;
}
