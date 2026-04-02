import { useState, useEffect, useRef, useCallback } from 'react'

// Import click sound
import clickSoundFile from '../main/denielcz-immersivecontrol-button-click-sound-463065.mp3'

// Note colors: all white
const LANE_FILL = ['#ffffff', '#ffffff', '#ffffff', '#ffffff']
const LANE_KEYS = ['a', 's', ';', "'"]
const LANE_KEY_LABELS = ['A', 'S', ';', "'"]
const LANE_NAMES = ['LEFT', 'DOWN', 'UP', 'RIGHT']

const DEFAULT_BEATS = 32

function buildChart(beats) {
    return Array.from({ length: beats }, () => [0, 0, 0, 0])
}

// ─── TitleBar ────────────────────────────────────────────────────────────────
function TitleBar() {
    return (
        <div className="drag-region"
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 36, padding: '0 16px', background: '#111111', borderBottom: '1px solid #222222', flexShrink: 0
            }}>
            <span style={{ fontFamily: 'Arial', fontSize: 8, color: '#ffffff', letterSpacing: 4 }}>
                FNF MOD MAKER
            </span>
            <button
                onClick={() => window.close?.()}
                style={{
                    WebkitAppRegion: 'no-drag', width: 12, height: 12, borderRadius: '50%',
                    background: '#333', border: '1px solid #444', cursor: 'pointer', flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#ff4466'}
                onMouseLeave={e => e.currentTarget.style.background = '#333'}
            />
        </div>
    )
}

// ─── SetupPanel ──────────────────────────────────────────────────────────────
function SetupPanel({ onStart }) {
    const [songFile, setSongFile] = useState(null)
    const [previewPos, setPreviewPos] = useState(0)
    const audioRef = useRef(null)
    
    // Load saved settings
    const savedSettings = JSON.parse(localStorage.getItem('fnf-settings') || '{}')
    const [songTitle, setSongTitle] = useState(savedSettings.songTitle || 'My Song')
    const [speed, setSpeed] = useState(savedSettings.speed || 2.0)
    const [bpm, setBpm] = useState(savedSettings.bpm || 120)
    const [beats, setBeats] = useState(savedSettings.beats || DEFAULT_BEATS)
    const [subdivision, setSubdivision] = useState(savedSettings.subdivision || 1)
    const [chart, setChart] = useState(
        savedSettings.chart && Array.isArray(savedSettings.chart)
            ? savedSettings.chart
            : buildChart((savedSettings.beats || DEFAULT_BEATS) * (savedSettings.subdivision || 1))
    )
    
    // Restore audio file from IndexedDB on startup
    useEffect(() => {
        if (!songFile && savedSettings.audioFileName) {
            const dbRequest = indexedDB.open('fnf-mod-maker', 1)
            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result
                if (!db.objectStoreNames.contains('audio')) {
                    db.createObjectStore('audio')
                }
            }
            dbRequest.onsuccess = (event) => {
                const db = event.target.result
                const tx = db.transaction('audio', 'readonly')
                const getRequest = tx.objectStore('audio').get('song')
                getRequest.onsuccess = () => {
                    const file = getRequest.result
                    if (file) {
                        setSongFile(file)
                        const url = URL.createObjectURL(file)
                        audioRef.current = new Audio(url)
                        audioRef.current.addEventListener('timeupdate', () => {
                            setPreviewPos(audioRef.current.currentTime)
                        })
                    }
                }
            }
        }
    }, [savedSettings.audioFileName])

    const toggleCell = (b, l) => {
        setChart(prev => {
            const next = prev.map(r => [...r])
            next[b][l] = next[b][l] ? 0 : 1
            // Save to localStorage
            localStorage.setItem('fnf-settings', JSON.stringify({
                songTitle, speed, bpm, beats, subdivision, chart: next, audioFileName: savedSettings.audioFileName
            }))
            return next
        })
    }

    const rebuildChart = () => {
        const newSize = beats * subdivision
        setChart(prev =>
            prev.length < newSize
                ? [...prev, ...buildChart(newSize - prev.length)]
                : prev.slice(0, newSize)
        )
    }

    // Auto-rebuild chart when beats or subdivision changes
    useEffect(() => {
        rebuildChart()
    }, [beats, subdivision])

    const randomizeChart = () => {
        const newChart = chart.map((row, idx) => {
            // Skip first 10 blocks to avoid spawning arrows immediately
            if (idx < 10) {
                return [0, 0, 0, 0]
            }
            return row.map(() => Math.random() > 0.7 ? 1 : 0)
        })
        setChart(newChart)
        // Save to localStorage
        localStorage.setItem('fnf-settings', JSON.stringify({
            songTitle, speed, bpm, beats, subdivision, chart: newChart, audioFileName: savedSettings.audioFileName
        }))
    }

    const handleSubdivisionChange = (newSub) => {
        setSubdivision(newSub)
        const newSize = beats * newSub
        const updatedChart = chart.length < newSize
            ? [...chart, ...buildChart(newSize - chart.length)]
            : chart.slice(0, newSize)
        setChart(updatedChart)
        // Save settings
        localStorage.setItem('fnf-settings', JSON.stringify({
            songTitle, speed: parseFloat(speed), bpm: parseInt(bpm), beats, subdivision: newSub, chart: updatedChart, audioFileName: savedSettings.audioFileName
        }))
    }

    const handleFile = (e) => {
        const f = e.target.files[0]
        if (f) {
            setSongFile(f)
            const newTitle = f.name.replace(/\.[^.]+$/, '')
            setSongTitle(newTitle)
            
            const url = URL.createObjectURL(f)
            audioRef.current = new Audio(url)
            audioRef.current.addEventListener('timeupdate', () => {
                setPreviewPos(audioRef.current.currentTime)
            })
            
            // Save audio file to IndexedDB (handles large files better than localStorage)
            const dbRequest = indexedDB.open('fnf-mod-maker', 1)
            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result
                if (!db.objectStoreNames.contains('audio')) {
                    db.createObjectStore('audio')
                }
            }
            dbRequest.onsuccess = (event) => {
                const db = event.target.result
                const tx = db.transaction('audio', 'readwrite')
                tx.objectStore('audio').put(f, 'song')
            }
            
            // Auto-calculate beats based on audio duration
            audioRef.current.addEventListener('loadedmetadata', () => {
                if (audioRef.current.duration && isFinite(audioRef.current.duration)) {
                    // Calculate beats: duration * (bpm / 60), rounded up to nearest 8
                    const calculatedBeats = Math.ceil((audioRef.current.duration * (bpm / 60)) / 8) * 8
                    const newBeats = Math.max(8, calculatedBeats)
                    setBeats(newBeats)
                    
                    // Rebuild chart with new beats
                    const newSize = newBeats * subdivision
                    const updatedChart = chart.length < newSize
                        ? [...chart, ...buildChart(newSize - chart.length)]
                        : chart.slice(0, newSize)
                    
                    setChart(updatedChart)
                    
                    // Update localStorage with new beats count and updated chart and filename
                    localStorage.setItem('fnf-settings', JSON.stringify({
                        songTitle: newTitle, speed, bpm, beats: newBeats, subdivision, chart: updatedChart, audioFileName: f.name
                    }))
                }
            }, { once: true })
        }
    }

    const playPreview = () => {
        if (audioRef.current && songFile) {
            if (audioRef.current.paused) {
                audioRef.current.play()
            } else {
                audioRef.current.pause()
            }
        }
    }

    const beatMs = 60000 / bpm

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
            padding: '1.5rem', gap: '1.25rem', background: '#141414'
        }}>

            {/* Header */}
            <div>
                <div style={{ fontFamily: 'Arial', fontSize: 14, color: '#ffffff', fontWeight: 'bold', marginBottom: 6 }}>
                    FNF MOD MAKER
                </div>
                <div style={{ fontFamily: 'Arial', fontSize: 13, color: '#888888' }}>
                    Create custom songs and chart notes
                </div>
            </div>

            {/* Song File & Title */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <FieldLabel>SONG FILE</FieldLabel>
                    <label style={{
                        position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 6, cursor: 'pointer',
                        background: '#1a1a1a',
                        border: `2px dashed ${songFile ? '#66ff99' : '#333333'}`,
                        transition: 'all 0.2s'
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: songFile ? '#66ff99' : '#333333', flexShrink: 0
                        }} />
                        <span style={{
                            fontFamily: 'Arial', fontSize: 14,
                            color: songFile ? '#ffffff' : '#555555',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                            {songFile ? songFile.name : 'Click to upload MP3/OGG/WAV'}
                        </span>
                        <input type="file" accept="audio/*" onChange={handleFile}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <FieldLabel>SONG TITLE</FieldLabel>
                    <input value={songTitle} onChange={e => {
                        const newTitle = e.target.value
                        setSongTitle(newTitle)
                        localStorage.setItem('fnf-settings', JSON.stringify({
                            songTitle: newTitle, speed, bpm, beats, subdivision, chart, audioFileName: savedSettings.audioFileName
                        }))
                    }}
                        style={{
                            fontFamily: 'Arial', fontSize: 14, color: '#ffffff',
                            padding: '12px 14px', borderRadius: 6, background: '#1a1a1a',
                            border: '1px solid #333333', outline: 'none',
                            width: '100%', boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = '#666666'}
                        onBlur={e => e.target.style.borderColor = '#333333'}
                    />
                </div>
            </div>

            {/* Preview Player */}
            {songFile && (
                <div style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
                    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={playPreview}
                            style={{
                                fontFamily: 'Arial', fontSize: 12, padding: '6px 14px',
                                background: '#ff4d8f', color: '#ffffff', border: 'none',
                                borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                            }}>
                            {audioRef.current?.paused !== false ? '▶ PLAY' : '⏸ PAUSE'}
                        </button>
                        <span style={{ fontFamily: 'Arial', fontSize: 12, color: '#888888' }}>
                            {Math.floor(previewPos || 0)}s
                        </span>
                    </div>
                    <div style={{
                        height: 4, background: '#222222', borderRadius: 2, overflow: 'hidden',
                        cursor: 'pointer'
                    }}>
                        <div style={{
                            height: '100%', width: `${audioRef.current ? (previewPos / (audioRef.current.duration || 1) * 100) : 0}%`,
                            background: '#ff4d8f'
                        }} />
                    </div>
                </div>
            )}

            {/* Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <SliderField label="SCROLL SPEED" value={speed} min={0.5} max={5} step={0.1}
                    display={speed.toFixed(1)} onChange={(val) => {
                        setSpeed(val)
                        localStorage.setItem('fnf-settings', JSON.stringify({
                            songTitle, speed: val, bpm, beats, subdivision, chart, audioFileName: savedSettings.audioFileName
                        }))
                    }} />
                <SliderField label="BPM" value={bpm} min={60} max={240} step={1}
                    display={bpm} onChange={(val) => {
                        setBpm(val)
                        localStorage.setItem('fnf-settings', JSON.stringify({
                            songTitle, speed, bpm: val, beats, subdivision, chart, audioFileName: savedSettings.audioFileName
                        }))
                    }} />
                <SliderField label="NOTE DENSITY" value={subdivision} min={1} max={8} step={1}
                    display={['1/4', '1/8', '1/16', '1/32', '1/64', '1/128', '1/256', '1/512'][subdivision - 1]} 
                    onChange={handleSubdivisionChange} />
            </div>

            {/* Chart Editor Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: '0.5rem'
            }}>
                <div>
                    <FieldLabel>CHART EDITOR</FieldLabel>
                    <div style={{ fontFamily: 'Arial', fontSize: 12, color: '#66ff99', marginTop: 4, fontWeight: 'bold' }}>
                        {beats} beats (auto)
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={randomizeChart}
                        style={{
                            fontFamily: 'Arial', fontSize: 7, padding: '5px 11px', borderRadius: 5,
                            background: 'transparent', border: '1px solid #ff4d8f66',
                            color: '#ff4d8f', cursor: 'pointer', letterSpacing: 2,
                            transition: 'all 0.12s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ff4d8f22'; e.currentTarget.style.borderColor = '#ff4d8f' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ff4d8f66' }}>
                        RANDOM
                    </button>
                </div>
            </div>

            {/* Timeline Visualization */}
            {songFile && (
                <div style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
                    padding: '8px 12px', height: 40, display: 'flex', alignItems: 'center',
                    gap: 6, overflow: 'hidden', position: 'relative'
                }}>
                    <div style={{ height: 24, width: '100%', position: 'relative', background: '#111111', borderRadius: 3 }}>
                        {/* Timeline bars */}
                        {chart.map((row, b) => {
                            const hasNote = row.some(n => n)
                            if (!hasNote) return null
                            const xPos = (b / chart.length) * 100
                            return (
                                <div key={b}
                                    style={{
                                        position: 'absolute',
                                        left: xPos + '%',
                                        top: 0, bottom: 0,
                                        width: '2px',
                                        background: '#ff4d8f',
                                        opacity: 0.6
                                    }}
                                />
                            )
                        })}
                        {/* Playhead */}
                        {audioRef.current && audioRef.current.duration && (
                            <div style={{
                                position: 'absolute',
                                left: (previewPos / (audioRef.current.duration) * 100) + '%',
                                top: 0, bottom: 0,
                                width: '2px',
                                background: '#66ff99'
                            }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Grid Editor */}
            <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8,
                background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a', padding: '12px'
            }}>

                {/* Lane header — small white circles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'center', paddingBottom: 2 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.3)', background: 'transparent'
                            }} />
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                        {chart.map((row, b) =>
                            row.map((on, l) => (
                                <button key={`${b}-${l}`} onClick={() => toggleCell(b, l)}
                                    style={{
                                        height: 24, borderRadius: 4, cursor: 'pointer',
                                        background: on ? (l % 2 === 0 ? 'rgba(102,255,153,0.25)' : 'rgba(255,77,143,0.25)') : '#111111',
                                        border: `1px solid ${on ? (l % 2 === 0 ? '#66ff9955' : '#ff4d8f55') : '#2a2a2a'}`,
                                        transition: 'all 0.1s'
                                    }}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Start Button */}
            <button
                onClick={() => songFile && onStart({ songFile, songTitle, speed, bpm, chart, subdivision })}
                disabled={!songFile}
                style={{
                    fontFamily: 'Arial', fontSize: 13, letterSpacing: 1, fontWeight: 'bold',
                    padding: '14px 0', borderRadius: 6, cursor: songFile ? 'pointer' : 'not-allowed',
                    background: songFile ? '#66ff99' : '#1a1a1a',
                    color: songFile ? '#111111' : '#333333',
                    border: songFile ? 'none' : '1px solid #2a2a2a',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (songFile) { e.currentTarget.style.background = '#99ffbb'; e.currentTarget.style.transform = 'scale(1.02)' } }}
                onMouseLeave={e => { if (songFile) { e.currentTarget.style.background = '#66ff99'; e.currentTarget.style.transform = 'scale(1)' } }}>
                {songFile ? '▶ START MOD' : '⚠ UPLOAD A SONG FIRST'}
            </button>
        </div>
    )
}

function FieldLabel({ children }) {
    return (
        <span style={{ fontFamily: 'Arial', fontSize: 7, color: '#555555', letterSpacing: 3 }}>
            {children}
        </span>
    )
}

function SliderField({ label, value, min, max, step, display, onChange }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <FieldLabel>{label}</FieldLabel>
                <span style={{ fontFamily: 'Arial', fontSize: 22, color: '#ffffff', fontWeight: 'bold' }}>
                    {display}
                </span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                style={{ accentColor: '#ffffff', width: '100%', cursor: 'pointer' }}
            />
        </div>
    )
}

function HoverBtn({ onClick, children }) {
    const [hov, setHov] = useState(false)
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                fontFamily: 'Arial', fontSize: 7, padding: '5px 11px', borderRadius: 5,
                background: hov ? '#2a2a2a' : 'transparent', border: '1px solid #333333',
                color: hov ? '#ffffff' : '#555555', cursor: 'pointer', letterSpacing: 2,
                transition: 'all 0.12s'
            }}>
            {children}
        </button>
    )
}

// ─── Particles ────────────────────────────────────────────────────────────────
function Particles({ lane, pressed }) {
    const [particles, setParticles] = useState([])
    const particleIntervalRef = useRef(null)

    useEffect(() => {
        if (pressed) {
            // Generate particles continuously while pressed
            if (!particleIntervalRef.current) {
                particleIntervalRef.current = setInterval(() => {
                    const newParticle = {
                        id: Math.random(),
                        x: 20 + Math.random() * 40,
                        y: 60, // Start at receptor bottom
                        vx: (Math.random() - 0.5) * 60,
                        vy: 50 + Math.random() * 30,
                        life: 0.6,
                    }
                    setParticles(prev => [...prev.slice(-30), newParticle])
                }, 30)
            }
        } else {
            if (particleIntervalRef.current) {
                clearInterval(particleIntervalRef.current)
                particleIntervalRef.current = null
            }
            // Keep particles visible for a bit after release
            setTimeout(() => setParticles([]), 200)
        }

        return () => {
            if (particleIntervalRef.current) {
                clearInterval(particleIntervalRef.current)
            }
        }
    }, [pressed])

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {particles.map((p, idx) => (
                <div key={p.id}
                    style={{
                        position: 'absolute',
                        left: p.x + 'px',
                        top: p.y + 'px',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: LANE_FILL[lane],
                        boxShadow: `0 0 6px ${LANE_FILL[lane]}`,
                        animation: `particleFloat-${idx} ${p.life}s ease-out forwards`,
                    }}
                />
            ))}
            {particles.length > 0 && (
                <style>{`
                    ${particles.map((p, idx) => `
                        @keyframes particleFloat-${idx} {
                            to {
                                opacity: 0;
                                transform: translate(${p.vx / 20}px, ${p.vy}px);
                            }
                        }
                    `).join('')}
                `}</style>
            )}
        </div>
    )
}

// ─── Receptor ─────────────────────────────────────────────────────────────────
// Stroke always white thin. Fill fades in as white or pink on press.
function Receptor({ lane, pressed }) {
    const fill = LANE_FILL[lane]
    return (
        <div style={{
            position: 'absolute', left: 5, bottom: 60,
            width: 70, height: 70, borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.35)',
            background: pressed ? fill + '30' : 'transparent',
            transform: pressed ? 'scale(0.88)' : 'scale(1)',
            transition: 'background 0.04s, transform 0.04s',
        }}>
            {/* Inner fill circle that fades in */}
            <div style={{
                position: 'absolute', inset: 5, borderRadius: '50%',
                background: fill,
                opacity: pressed ? 0.85 : 0,
                transition: 'opacity 0.04s',
            }} />
        </div>
    )
}

// ─── GameView ─────────────────────────────────────────────────────────────────
function GameView({ config, onStop }) {
    const stageRef = useRef(null)
    const audioRef = useRef(null)
    const rafRef = useRef(null)
    const stateRef = useRef({
        activeNotes: [], score: 0, combo: 0, health: 80, songStart: 0, paused: false, completedBeats: new Set(),
        perfect: 0, good: 0, bad: 0, miss: 0, totalHits: 0
    })

    const [hud, setHud] = useState({ score: 0, combo: 0, health: 80 })
    const [judgment, setJudgment] = useState({ text: '', color: '#fff', visible: false })
    const [receptorPressed, setReceptorPressed] = useState([false, false, false, false])
    const [paused, setPaused] = useState(false)

    const showJudge = useCallback((text, color) => {
        setJudgment({ text, color, visible: true })
        setTimeout(() => setJudgment(j => ({ ...j, visible: false })), 400)
    }, [])

    const updateHud = useCallback(() => {
        const s = stateRef.current
        setHud({ score: s.score, combo: s.combo, health: s.health })
    }, [])

    const stopGame = useCallback(() => {
        cancelAnimationFrame(rafRef.current)
        audioRef.current?.pause()
        stageRef.current?.querySelectorAll('.fnf-note').forEach(n => n.remove())
        // Only show results if completed the song (not dead)
        const s = stateRef.current
        const duration = audioRef.current?.duration || 0
        const accuracy = s.totalHits > 0 ? Math.round(((s.perfect * 100 + s.good * 90 + s.bad * 70) / (s.totalHits * 100)) * 100) : 0
        onStop('complete', {
            score: s.score,
            perfect: s.perfect,
            good: s.good,
            bad: s.bad,
            miss: s.miss,
            totalHits: s.totalHits,
            accuracy,
            duration,
            songTitle: config.songTitle
        })
    }, [onStop, config.songTitle])

    const dieGame = useCallback(() => {
        cancelAnimationFrame(rafRef.current)
        audioRef.current?.pause()
        stageRef.current?.querySelectorAll('.fnf-note').forEach(n => n.remove())
        // Go back to setup without showing results
        onStop('death', null)
    }, [onStop])

    const doMiss = useCallback((note) => {
        note.hit = true
        note.el?.remove(); note.el = null
        // Mark beat/lane as completed so it won't be recreated
        const s = stateRef.current
        s.completedBeats.add(`${note.beat}-${note.lane}`)
        s.miss++
        s.totalHits++
        s.combo = 0
        s.health = Math.max(0, s.health - 10)
        updateHud()
        showJudge('MISS', '#ff6666')
        if (s.health <= 0) dieGame()
    }, [showJudge, updateHud, dieGame])

    const hitNote = useCallback((lane) => {
        const s = stateRef.current
        const now = Date.now()
        let closest = null, minDist = Infinity
        for (const n of s.activeNotes) {
            if (n.lane !== lane || n.hit) continue
            const d = Math.abs(n.hitTime - now)
            if (d < minDist && d < 100) { minDist = d; closest = n }
        }
        if (!closest) return

        // Play click sound
        if (s.clickSound) {
            s.clickSound.currentTime = 0
            s.clickSound.play().catch(() => {})
        }

        closest.hit = true
        closest.el?.remove(); closest.el = null
        // Mark beat/lane as completed so it won't be recreated
        s.completedBeats.add(`${closest.beat}-${closest.lane}`)
        // Remove hit note immediately so it can't be missed
        s.activeNotes = s.activeNotes.filter(n => !n.hit)

        s.combo++
        s.totalHits++
        let pts, text, color
        if (minDist < 15) { pts = 350; text = 'PERFECT'; color = '#66ccff'; s.perfect++ }
        else if (minDist < 40) { pts = 200; text = 'GOOD'; color = '#66ff99'; s.good++ }
        else if (minDist < 100) { pts = 100; text = 'BAD'; color = '#999999'; s.bad++ }
        else { pts = 50; text = 'MISS'; color = '#ff4466'; s.miss++ }

        s.score += pts * Math.max(1, Math.floor(s.combo / 10))
        s.health = Math.min(100, s.health + 3)
        updateHud()
        showJudge(text, color)
    }, [showJudge, updateHud])

    const togglePause = useCallback(() => {
        const s = stateRef.current
        s.paused = !s.paused
        setPaused(s.paused)
        if (s.paused) audioRef.current?.pause()
        else audioRef.current?.play()
    }, [])

    useEffect(() => {

        const url = URL.createObjectURL(config.songFile)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = stopGame
        audio.play()

        const beatMs = 60000 / config.bpm
        const s = stateRef.current
        s.songStart = Date.now()
        s.activeNotes = []; s.score = 0; s.combo = 0; s.health = 80
        s.completedBeats = new Set()
        
        // Load click sound effect - loud click
        const clickSound = new Audio(clickSoundFile)
        clickSound.volume = 1.0  // Maximum volume
        s.clickSound = clickSound
        
        const subdivision = config.subdivision || 1
        const subdivisionMs = beatMs / subdivision

        const RECEPTOR_BOTTOM = 65

        const loop = () => {
            if (!s.paused) {
                const now = Date.now()
                const elapsed = now - s.songStart
                const futureIdx = Math.floor((elapsed + 2200) / subdivisionMs)

                for (let b = 0; b <= Math.min(futureIdx, config.chart.length - 1); b++) {
                    for (let l = 0; l < 4; l++) {
                        const key = `${b}-${l}`
                        if (config.chart[b][l] && !s.completedBeats.has(key) && !s.activeNotes.find(n => n.beat === b && n.lane === l)) {
                            const hitTime = s.songStart + b * subdivisionMs
                            s.activeNotes.push({ beat: b, lane: l, hitTime: hitTime, hit: false, el: null })
                        }
                    }
                }

                const laneEls = stageRef.current?.querySelectorAll('.fnf-lane')
                for (const note of s.activeNotes) {
                    if (note.hit) continue
                    const timeToHit = note.hitTime - now
                    const yFromBottom = RECEPTOR_BOTTOM + timeToHit * config.speed * 0.35

                    if (!note.el) {
                        // Notes: full colored FNF circles (no glow)
                        const fill = LANE_FILL[note.lane]
                        const el = document.createElement('div')
                        el.className = 'fnf-note'
                        el.style.cssText = `
              position:absolute;left:10px;width:60px;height:60px;border-radius:50%;
              background:${fill};
              pointer-events:none;
              transition:opacity 0.1s;
            `
                        laneEls?.[note.lane]?.appendChild(el)
                        note.el = el
                    }

                    note.el.style.bottom = yFromBottom + 'px'
                    note.el.style.opacity = '1'
                    if (yFromBottom < -60 && !note.hit) {
                        doMiss(note)
                    }
                }

                s.activeNotes = s.activeNotes.filter(n => !n.hit)
            }
            rafRef.current = requestAnimationFrame(loop)
        }

        rafRef.current = requestAnimationFrame(loop)

        const onKey = (e) => {
            const lane = LANE_KEYS.indexOf(e.key)
            if (lane === -1) return
            e.preventDefault()
            if (e.type === 'keydown' && !e.repeat) {
                setReceptorPressed(p => { const n = [...p]; n[lane] = true; return n })
                hitNote(lane)
            }
            if (e.type === 'keyup') {
                setReceptorPressed(p => { const n = [...p]; n[lane] = false; return n })
            }
        }

        window.addEventListener('keydown', onKey)
        window.addEventListener('keyup', onKey)

        return () => {
            cancelAnimationFrame(rafRef.current)
            audio.pause()
            URL.revokeObjectURL(url)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('keyup', onKey)
        }
    }, []) // eslint-disable-line

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#141414' }}>

            {/* Stage */}
            <div ref={stageRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#111111' }}>

                {/* Lanes */}
                <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '50%',
                    transform: 'translateX(-50%)', width: 400, display: 'flex'
                }}>
                    {[0, 1, 2, 3].map(l => (
                        <div key={l} className="fnf-lane" style={{ position: 'relative', flex: 1 }}>
                            <Receptor lane={l} pressed={receptorPressed[l]} />
                        </div>
                    ))}
                </div>

                {/* HUD */}
                <div style={{
                    position: 'absolute', top: 12, left: 0, right: 0,
                    display: 'flex', justifyContent: 'space-between', padding: '0 20px', pointerEvents: 'none'
                }}>
                    <div style={{ fontFamily: 'Arial', fontSize: 12, color: '#ffffff' }}>
                        {hud.combo}x
                    </div>
                    <div style={{
                        fontFamily: 'Arial', fontSize: 7, color: '#333333',
                        letterSpacing: 2, alignSelf: 'center'
                    }}>
                        {config.songTitle.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: 'Arial', fontSize: 9, color: '#ffffff', textAlign: 'right' }}>
                        <div style={{ fontSize: 6, color: '#444444', marginBottom: 2, letterSpacing: 1 }}>SCORE</div>
                        {hud.score.toLocaleString()}
                    </div>
                </div>

                {/* Judgment */}
                <div style={{
                    position: 'absolute', left: '50%', top: '42%',
                    transform: `translate(-50%, -50%) scale(${judgment.visible ? 1.04 : 0.9})`,
                    fontFamily: 'Arial', fontSize: 10, letterSpacing: 3, fontWeight: 'bold',
                    backgroundImage: `linear-gradient(135deg, ${judgment.color}, ${judgment.color}cc)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: `drop-shadow(0 0 8px ${judgment.color})`,
                    pointerEvents: 'none',
                    opacity: judgment.visible ? 1 : 0,
                    transition: 'opacity 0.2s, transform 0.2s',
                }}>
                    {judgment.text}
                </div>

                {/* Health bar */}
                <div style={{
                    position: 'absolute', bottom: 12, left: '50%',
                    transform: 'translateX(-50%)', width: 320
                }}>
                    <div style={{ height: 2, background: '#222222', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', width: `${hud.health}%`,
                            background: '#ffffff',
                            borderRadius: 999, transition: 'width 0.2s',
                        }} />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                background: '#111111', borderTop: '1px solid #1e1e1e', flexShrink: 0
            }}>
                <CtrlBtn onClick={togglePause}>{paused ? 'RESUME' : 'PAUSE'}</CtrlBtn>
                <CtrlBtn onClick={stopGame}>QUIT</CtrlBtn>

                {/* Key indicators */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                    {LANE_KEY_LABELS.map((k, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{
                                fontFamily: 'Arial', fontSize: 5,
                                color: '#333333', letterSpacing: 1
                            }}>
                                {LANE_NAMES[i]}
                            </span>
                            {/* Mini circle indicator */}
                            <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                border: '1.5px solid rgba(255,255,255,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', transition: 'border-color 0.05s',
                                borderColor: receptorPressed[i] ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                            }}>
                                {/* Fill circle */}
                                <div style={{
                                    position: 'absolute', inset: 4, borderRadius: '50%',
                                    background: LANE_FILL[i],
                                    opacity: receptorPressed[i] ? 0.9 : 0,
                                    transition: 'opacity 0.04s',
                                }} />
                                <span style={{
                                    fontFamily: 'Arial', fontSize: 7,
                                    color: receptorPressed[i] ? '#111111' : '#444444',
                                    position: 'relative', zIndex: 1, transition: 'color 0.04s'
                                }}>
                                    {k}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function CtrlBtn({ onClick, children }) {
    const [hov, setHov] = useState(false)
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                fontFamily: 'Arial', fontSize: 7, letterSpacing: 2,
                padding: '6px 13px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid #333333',
                background: hov ? '#222222' : 'transparent',
                color: hov ? '#ffffff' : '#666666',
                transition: 'all 0.12s'
            }}>
            {children}
        </button>
    )
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function Results({ stats, onExit }) {
    const [fadeOut, setFadeOut] = useState(false)

    const handleExit = () => {
        setFadeOut(true)
        setTimeout(onExit, 400)
    }

    const perfectPercent = stats.totalHits > 0 ? (stats.perfect / stats.totalHits) * 100 : 0
    const goodPercent = stats.totalHits > 0 ? (stats.good / stats.totalHits) * 100 : 0
    const badPercent = stats.totalHits > 0 ? (stats.bad / stats.totalHits) * 100 : 0
    const missPercent = stats.totalHits > 0 ? (stats.miss / stats.totalHits) * 100 : 0

    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#141414',
            display: 'flex', flexDirection: 'column',
            opacity: fadeOut ? 0 : 1, transition: 'opacity 0.4s',
            overflow: 'auto', padding: '16px', minHeight: '100vh',
            color: '#ffffff', fontFamily: 'Arial, sans-serif'
        }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .stat-card { 
                    background: #1a1a1a;
                    border: 1px solid #2a2a2a;
                    padding: 10px 12px;
                    border-radius: 4px;
                    animation: slideUp 0.6s ease-out forwards;
                }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: 12, animation: 'slideUp 0.5s ease-out' }}>
                <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: 1, color: '#ffffff' }}>
                    SONG COMPLETE
                </h1>
                <p style={{ fontSize: 11, color: '#888888', margin: 0 }}>
                    {stats.songTitle}
                </p>
            </div>

            {/* Main Stats Grid - 6 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 12 }}>
                
                {/* Perfect */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.1s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>PERFECT</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.15s both` }}>
                        <div style={{ fontSize: 8, color: '#888888' }}>count</div>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>{stats.perfect}</div>
                        <div style={{ fontSize: 8, color: '#666666', marginTop: 1 }}>{perfectPercent.toFixed(0)}%</div>
                    </div>
                </div>

                {/* Good */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.12s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>GOOD</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.17s both` }}>
                        <div style={{ fontSize: 8, color: '#888888' }}>count</div>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>{stats.good}</div>
                        <div style={{ fontSize: 8, color: '#666666', marginTop: 1 }}>{goodPercent.toFixed(0)}%</div>
                    </div>
                </div>

                {/* Bad */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.14s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>BAD</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.19s both` }}>
                        <div style={{ fontSize: 8, color: '#888888' }}>count</div>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>{stats.bad}</div>
                        <div style={{ fontSize: 8, color: '#666666', marginTop: 1 }}>{badPercent.toFixed(0)}%</div>
                    </div>
                </div>

                {/* Miss */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.16s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>MISS</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.21s both` }}>
                        <div style={{ fontSize: 8, color: '#888888' }}>count</div>
                        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>{stats.miss}</div>
                        <div style={{ fontSize: 8, color: '#666666', marginTop: 1 }}>{missPercent.toFixed(0)}%</div>
                    </div>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.18s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>SCORE</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.23s both` }}>
                        <div style={{ fontSize: 7, color: '#888888' }}>total</div>
                        <div style={{ fontSize: 11, fontWeight: 'bold', color: '#ffffff' }}>{(stats.score / 1000).toFixed(0)}k</div>
                    </div>
                </div>

                {/* Accuracy */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'slideUp 0.6s ease-out 0.20s both' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>ACCURACY</div>
                    <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out 0.25s both` }}>
                        <div style={{ fontSize: 7, color: '#888888' }}>percent</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ffffff' }}>{stats.accuracy}%</div>
                    </div>
                </div>
            </div>

            {/* Secondary Stats Grid - 6 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 12 }}>
                {[
                    { label: 'Total Hits', value: stats.totalHits, delay: 0.22 },
                    { label: 'Duration', value: Math.floor(stats.duration) + 's', delay: 0.24 },
                    { label: 'Notes/Sec', value: (stats.totalHits / Math.max(stats.duration, 1)).toFixed(1), delay: 0.26 },
                    { label: 'Avg Timing', value: ((perfectPercent + goodPercent) / 2).toFixed(0) + '%', delay: 0.28 },
                    { label: 'Hit Rate', value: ((stats.totalHits / (stats.totalHits + stats.miss)) * 100).toFixed(0) + '%', delay: 0.30 },
                    { label: 'Rating', value: stats.accuracy >= 90 ? 'S+' : stats.accuracy >= 80 ? 'A' : stats.accuracy >= 70 ? 'B' : 'C', delay: 0.32 }
                ].map((item, idx) => (
                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: `slideUp 0.6s ease-out ${item.delay}s both` }}>
                        <div style={{ fontSize: 8, letterSpacing: 1, color: '#555555', fontWeight: 'bold' }}>{item.label.toUpperCase()}</div>
                        <div className="stat-card" style={{ animation: `slideUp 0.6s ease-out ${item.delay + 0.05}s both` }}>
                            <div style={{ fontSize: 10, fontWeight: 'bold', color: '#ffffff' }}>{item.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Exit Button */}
            <button
                onClick={handleExit}
                style={{
                    padding: '8px 0',
                    borderRadius: 4,
                    border: '1px solid #2a2a2a',
                    cursor: 'pointer',
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: 'bold',
                    background: '#1a1a1a',
                    color: '#ffffff',
                    transition: 'all 0.2s',
                    animation: 'slideUp 0.6s ease-out 0.45s both'
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.background = '#2a2a2a'
                    e.currentTarget.style.borderColor = '#3a3a3a'
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.background = '#1a1a1a'
                    e.currentTarget.style.borderColor = '#2a2a2a'
                }}>
                BACK TO MAIN
            </button>
        </div>
    )
}

// ─── CtrlBtn ───────────────────────────────────────────────────────────────────

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    const [screen, setScreen] = useState('setup')
    const [gameConfig, setGameConfig] = useState(null)
    const [gameStats, setGameStats] = useState(null)

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100vh',
            background: '#111111', overflow: 'hidden'
        }}>
            <TitleBar />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {screen === 'setup'
                    ? <SetupPanel onStart={cfg => { setGameConfig(cfg); setScreen('game') }} />
                    : screen === 'game'
                    ? <GameView config={gameConfig} onStop={(status, stats) => {
                        if (status === 'complete') {
                            setGameStats(stats)
                            setScreen('results')
                        } else {
                            setScreen('setup')
                        }
                    }} />
                    : <Results stats={gameStats} onExit={() => { setScreen('setup'); setGameStats(null) }} />
                }
            </div>
        </div>
    )
}